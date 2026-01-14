document.addEventListener('deviceready', function() {
    // --- State Variables ---
    const og_devices_localStorage_name = 'og_devices_v1';
    let devlist = [];
    let currdev = -1;
    let dev_add_by = '';
    let selected = -1;
    let config_currdev = null;
    let tm_devices = null;
    let tm_currdev = null;
    window.open = cordova.InAppBrowser.open;

    // --- DOM Element References ---
    const pages = document.querySelectorAll('.page');
    const pageDevices = document.getElementById('page_devices');
    const pageCurrDev = document.getElementById('page_currdev');

    // --- Helper Functions ---
    const showPage = (pageId) => {
        pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    };

    const showMsg = (selector, msg, duration = 0, color = 'black') => {
        const el = document.querySelector(selector);
        if (el) {
            el.textContent = msg;
            el.style.color = color;
            if (duration > 0) {
                setTimeout(() => { el.textContent = ''; }, duration);
            }
        }
    };
    const clearMsg = (selector) => showMsg(selector, '');

    const save_localStorage = () => {
        const og_devices = { 'currdev': currdev, 'devlist': devlist };
        localStorage.setItem(og_devices_localStorage_name, JSON.stringify(og_devices));
    };

    const load_localStorage = () => {
        const store = localStorage.getItem(og_devices_localStorage_name);
        if (store) {
            try {
                const og_devices = JSON.parse(store);
                devlist = og_devices.devlist || [];
                currdev = og_devices.currdev || -1;
                sync_table_to_devlist();
            } catch (e) {
                console.error("Error parsing localStorage data", e);
                devlist = [];
                currdev = -1;
            }
        }
        document.getElementById('ndevs').textContent = devlist.length;
    };

    // --- Confirmation Modal Logic ---
    const confirmModal = document.getElementById('popup_confirm');
    const confirmMessageEl = document.getElementById('confirm_message');
    const confirmTitleEl = document.getElementById('confirm_title');
    let confirmOkBtn = document.getElementById('btn_confirm_ok');
    let confirmCancelBtn = document.getElementById('btn_confirm_cancel');

    const showConfirmation = (message, onConfirm, options = {}) => {
        confirmMessageEl.textContent = message;
        confirmTitleEl.textContent = options.title || 'Are you sure?';

        // Use cloneNode to remove old event listeners
        let newOkBtn = confirmOkBtn.cloneNode(true);
        confirmOkBtn.parentNode.replaceChild(newOkBtn, confirmOkBtn);
        confirmOkBtn = newOkBtn; // Update reference to the new button

        let newCancelBtn = confirmCancelBtn.cloneNode(true);
        confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);
        confirmCancelBtn = newCancelBtn; // Update reference to the new button

        // Set button styles on the new button
        confirmOkBtn.className = 'btn';
        confirmOkBtn.classList.add(options.okClass || 'btn-primary');
        confirmOkBtn.textContent = options.okText || 'OK';

        const closeConfirm = () => confirmModal.classList.remove('visible');

        confirmOkBtn.addEventListener('click', () => {
            closeConfirm();
            onConfirm();
        });

        confirmCancelBtn.addEventListener('click', closeConfirm);

        confirmModal.classList.add('visible');
    };


    // --- UI Update Functions ---
    const door2str = (d) => {
        const status = {
            0: 'closed', 1: 'OPEN', 2: 'Stopped', 3: 'closing',
            4: 'OPENING', 5: '(unknown)'
        };
        return status[d] || '(offline)';
    };

    const car2str = (c) => {
        if (c === 0 || c === '0') return 'vacant';
        if (c === 1 || c === '1') return 'parked';
        return '-';
    };

    const conf2str_short = (c) => {
        if (c.type === 'ip') return `ip (${c.ip})`;
        return `${c.type} (${c.token.slice(0, 4)}...${c.token.slice(-4)}@${c.server})`;
    };

    const update_lb_sel_msg = () => {
        const msgEl = document.getElementById('lb_sel_msg');
        msgEl.textContent = selected === -1 ? '-' : conf2str_short(devlist[selected]);
    };

    const updateControlButtons = () => {
        const isSelected = selected >= 0;
        document.querySelectorAll('.clbtnmod').forEach(btn => {
            btn.disabled = !isSelected;
        });
        if (isSelected) {
            document.getElementById('btn_dev_click').disabled = devlist[selected].door === -1;
            document.getElementById('btn_dev_up').disabled = selected < 1;
            document.getElementById('btn_dev_down').disabled = selected >= devlist.length - 1;
        }
    };

    const select_tr = (id) => {
        const prevSelected = selected;

        // Un-highlight previous
        if (prevSelected >= 0) {
            const prevRow = document.getElementById(`dev${prevSelected}`);
            if (prevRow) prevRow.classList.remove('selected');
        }

        if (prevSelected === id) {
            selected = -1; // Deselect
        } else {
            selected = id;
            const newRow = document.getElementById(`dev${id}`);
            if (newRow) newRow.classList.add('selected');
        }
        updateControlButtons();
        update_lb_sel_msg();
    };

    const sync_table_to_devlist = () => {
        const tbody = document.querySelector('#tab_devlist tbody');
        tbody.innerHTML = '';
        devlist.forEach((config, i) => {
            const r = document.createElement('tr');
            r.id = `dev${i}`;
            r.innerHTML = `
                <td style="text-align: center" id="name${i}">
                    <p id="text_name${i}">${config.name}</p>
                    <img id="img${i}" class="device-icon" src=${config.image || "img/PLACEHOLDERGarageIcon.png"} data-index="${i}" alt="Garage Icon" style="width: 50px; height: 50px">
                </td>
                <td id="door${i}"></td>
                <td id="car${i}"></td>
                <td id="dist${i}"></td>
            `;
            // Add click listener to the whole row for selection
            r.addEventListener('click', () => select_tr(i));
            // Add click listener to door status for action
            r.querySelector(`#door${i}`).addEventListener('click', (e) => {
                e.stopPropagation(); // prevent row selection event
                if (selected === i) {
                    document.getElementById('btn_dev_click').click();
                }
            });
            tbody.appendChild(r);

            r.querySelector(`#img${i}`).addEventListener('click', (e) => {
                e.stopPropagation();
                update_image(i);
            })
        });
        update_tr(0, devlist.length);
        if(selected >= devlist.length) selected = -1;
        if(selected > -1) {
            const selectedRow = document.getElementById(`dev${selected}`);
            if(selectedRow) selectedRow.classList.add('selected');
        }
        updateControlButtons();
        update_lb_sel_msg();
    };

    const update_image = (index) => {
        if (!navigator.camera) {
            alert("Camera plugin not found");
            return;
        }

        // get picture as base 64 string
        navigator.camera.getPicture((imageData) => {
            var image = document.getElementById(`img${index}`)

            // Prepend header if cordova does not automatically
            if (imageData.startsWith('data:image')) {
                image.src = imageData;
            } else {
                image.src = "data:image/jpeg;base64," + imageData;
            }

            devlist[index].image = imageData;

            localStorage.setItem('devlist', JSON.stringify(devlist));

        }, (error) => {
            console.log("Error or cancelled: " + error);

        }, {
            quality: 50,
            destinationType: Camera.DestinationType.DATA_URL,
            sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
            targetWidth: 300,
            targetHeight: 300
        });
        
    }

    const update_tr = (start, n) => {
        for (let i = start; i < start + n; i++) {
            const d = devlist[i];
            document.getElementById(`text_name${i}`).textContent = d.name;
            if (d.door === -1) {
                document.getElementById(`door${i}`).textContent = '(offline)';
                document.getElementById(`car${i}`).textContent = '-';
                document.getElementById(`dist${i}`).textContent = '-';
            } else {
                document.getElementById(`door${i}`).textContent = door2str(d.door);
                document.getElementById(`car${i}`).textContent = car2str(d.car);
                document.getElementById(`dist${i}`).textContent = d.dist;
            }
        }
    };

    const update_tr_currdev = () => {
        const d = config_currdev;
        document.querySelector('#name_curr h3').textContent = d.name;
        const btn = document.getElementById('currdev-btn');

        if (d.door === -1) {
            document.getElementById('door_curr').textContent = '(offline)';
            document.getElementById('car_curr').textContent = '-';
            document.getElementById('dist_curr').textContent = '-';
            btn.disabled = true;
            btn.textContent = 'Click';
            btn.className = 'btn'; // Reset classes
        } else {
            document.getElementById('door_curr').textContent = door2str(d.door);
            document.getElementById('car_curr').textContent = car2str(d.car);
            document.getElementById('dist_curr').textContent = d.dist;
            btn.disabled = false;

            // Reset all state classes first
            btn.classList.remove('open', 'closed', 'opening', 'stopped', 'closing');

            switch (d.door) {
                case 0: // closed
                    btn.textContent = 'Open';
                    btn.classList.add('closed');
                    break;
                case 1: // OPEN
                    btn.textContent = 'Close';
                    btn.classList.add('open');
                    break;
                case 2: // Stopped
                    btn.textContent = 'Click';
                    btn.classList.add('stopped');
                    break;
                case 3: // closing
                    btn.textContent = 'Click';
                    btn.classList.add('closing');
                    break;
                case 4: // OPENING
                    btn.textContent = 'Click';
                    btn.classList.add('opening');
                    break;
                default: // unknown or other states
                    btn.textContent = 'Click';
                    break;
            }
        }
    };

    // --- Device Communication ---
    const connect_device = async (config, dtype, success_cb, fail_cb, devid = -1, endpoint = '') => {
        let comm;
        if (config.type === 'ip') {
            comm = `http://${config.ip}${endpoint || '/jc'}`;
        } else if (config.type === 'blynk') {
            const protocol = (config.server === 'blynk-cloud.com' || config.port == 80) ? 'http://' : 'https://';
            comm = `${protocol}${config.server}:${config.port}/${config.token}${endpoint || '/project'}`;
        } else if (config.type === 'otc') {
            comm = `https://${config.server}:${config.port || 443}/forward/v1/${config.token}${endpoint || '/jc'}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(comm, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const result = dtype.toLowerCase() === 'json' ? await response.json() : await response.text();
            success_cb(result, devid);
        } catch (error) {
            console.error('Connection failed:', error);
            fail_cb(devid);
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const find_virtual_pin_value = (r, pin) => {
        if (!r.widgets) return -1;
        const widget = r.widgets.find(w => w.pin === pin);
        return widget ? widget.value : -1;
    };

    // --- Status Update Loops ---
    const update_status = async () => {
        for (let i = 0; i < devlist.length; i++) {
            const config = devlist[i];
            let skip = false;

            if (config.type === 'blynk') {
                await new Promise(resolve => {
                    connect_device(config, 'text',
                        (r) => { if (r === 'false') skip = true; resolve(); },
                        () => { skip = true; resolve(); },
                        i, '/isHardwareConnected'
                    );
                });

                if (skip && devlist[i].door !== -1) {
                    devlist[i].door = -1;
                    update_tr(i, 1);
                    save_localStorage();
                    updateControlButtons();
                }
            }

            if (skip) continue;

            connect_device(config, 'JSON', (r, id) => {
                let dirty = false;
                let door = -1, car, dist, name;
                if (devlist[id].type === 'blynk') {
                    name = r.name;
                    door = parseInt(find_virtual_pin_value(r, 0)) === 0 ? 0 : 1;
                    dist = parseInt(find_virtual_pin_value(r, 3));
                    car = parseInt(find_virtual_pin_value(r, 4)) === 0 ? 0 : 1;
                } else {
                    ({ door, vehicle: car, dist, name } = r);
                }

                if (devlist[id].door != door) { devlist[id].door = door; dirty = true; }
                if (devlist[id].car != car) { devlist[id].car = car; dirty = true; }
                if (devlist[id].dist != dist) { devlist[id].dist = dist; dirty = true; }
                if (devlist[id].name != name) { devlist[id].name = name; dirty = true; }

                if (dirty) {
                    update_tr(id, 1);
                    save_localStorage();
                    if (selected === id) updateControlButtons();
                }
            }, (id) => {
                if (devlist[id].door !== -1) {
                    devlist[id].door = -1;
                    update_tr(id, 1);
                    save_localStorage();
                    if (selected === id) updateControlButtons();
                }
            }, i);
        }
    };

    const update_status_currdev = async () => {
        if (!config_currdev) return;
        let skip = false;

        if (config_currdev.type === 'blynk') {
            await new Promise(resolve => {
                connect_device(config_currdev, 'text',
                    (r) => { if (r === 'false') skip = true; resolve(); },
                    () => { skip = true; resolve(); },
                    -1, '/isHardwareConnected'
                );
            });
            if (skip && config_currdev.door !== -1) {
                config_currdev.door = -1;
                update_tr_currdev();
            }
        }

        if (skip) return;

        connect_device(config_currdev, 'JSON', (r) => {
            let dirty = false;
            let door = -1, car, dist, name;
            if (config_currdev.type === 'blynk') {
                name = r.name;
                door = parseInt(find_virtual_pin_value(r, 0)) === 0 ? 0 : 1;
                dist = parseInt(find_virtual_pin_value(r, 3));
                car = parseInt(find_virtual_pin_value(r, 4)) === 0 ? 0 : 1;
            } else {
                ({ door, vehicle: car, dist, name } = r);
            }

            if (config_currdev.door != door) { config_currdev.door = door; dirty = true; }
            if (config_currdev.car != car) { config_currdev.car = car; dirty = true; }
            if (config_currdev.dist != dist) { config_currdev.dist = dist; dirty = true; }
            if (config_currdev.name != name) { config_currdev.name = name; dirty = true; }

            if (dirty) update_tr_currdev();
        }, () => {
            if (config_currdev.door !== -1) {
                config_currdev.door = -1;
                update_tr_currdev();
            }
        }, -1);
    };

    // --- Click Handlers & Event Listeners ---
    document.getElementById('btn_dev_del').addEventListener('click', () => {
        if (selected < 0) return;
        showConfirmation(
            'This will permanently delete the selected device.',
            () => {
                devlist.splice(selected, 1);
                document.getElementById('ndevs').textContent = devlist.length;
                const currentSelected = selected;
                selected = -1;
                sync_table_to_devlist();
                save_localStorage();
                if (currentSelected > 0) {
                    select_tr(currentSelected - 1);
                } else {
                    select_tr(-1);
                }
            },
            {
                title: 'Delete Device?',
                okText: 'Delete',
                okClass: 'btn-danger'
            }
        );
    });

    const swap_dev = (i, j) => {
        [devlist[i], devlist[j]] = [devlist[j], devlist[i]];
        save_localStorage();
    };

    document.getElementById('btn_dev_up').addEventListener('click', () => {
        if (selected < 1) return;
        swap_dev(selected, selected - 1);
        sync_table_to_devlist();
        select_tr(selected - 1);
    });

    document.getElementById('btn_dev_down').addEventListener('click', () => {
        if (selected < 0 || selected >= devlist.length - 1) return;
        swap_dev(selected, selected + 1);
        sync_table_to_devlist();
        select_tr(selected + 1);
    });

    document.getElementById('btn_dev_got').addEventListener('click', () => {
        if (selected < 0 || selected >= devlist.length) return;
        currdev = selected;
        save_localStorage();
        showPage('page_currdev');
        handlePageCurrDevShow();
    });

    const perform_btn_click = (config) => {
        if (config.door === -1) return;
        showConfirmation(
            'The door will start moving. Are you sure?',
            () => {
                let endpoint;
                if (config.type === 'blynk') {
                    endpoint = '/update/V1?value=1';
                    connect_device(config, 'text',
                        () => setTimeout(() => {
                            connect_device(config, 'text', () => {}, () => {}, -1, '/update/V1?value=0');
                        }, 500),
                        () => alert('Request failed!'), -1, endpoint);
                } else {
                    endpoint = (config.type === 'ip') ? `/cc?dkey=${config.devkey}&click=1` : '/cc?click=1';
                    connect_device(config, 'JSON', (result) => {
                        if (result.result === 1) return;
                        alert(result.result === 2 ? 'Incorrect device key!' : JSON.stringify(result));
                    }, () => alert('Request failed!'), -1, endpoint);
                }
            },
            {
                title: 'Confirm Action',
                okText: 'Confirm'
            }
        );
    };

    document.getElementById('btn_dev_click').addEventListener('click', () => {
        if (selected < 0) return;
        perform_btn_click(devlist[selected]);
    });

    document.getElementById('currdev-btn').addEventListener('click', () => {
        perform_btn_click(config_currdev);
    });

    document.getElementById('btn_dev_list').addEventListener('click', () => {
        currdev = -1;
        config_currdev = null;
        save_localStorage();
        showPage('page_devices');
        handlePageDevicesShow();
    });

    document.getElementById('btn_dev_home').addEventListener('click', () => {
        let url;
        const c = config_currdev;
        if (c.type === 'ip') url = `http://${c.ip}`;
        else if (c.type === 'otc') url = `https://${c.server}:${c.port}/forward/v1/${c.token}`;
        else return;
        window.open(url, '_blank');
    });

    // --- Add Device Modal Logic ---
    const modal = document.getElementById('popup_dev_add');
    const openModal = () => modal.classList.add('visible');
    const closeModal = () => modal.classList.remove('visible');

    document.getElementById('btn_dev_add').addEventListener('click', (e) => {
        e.preventDefault();
        const menu = document.getElementById('dev_addmenu');
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    });

    document.getElementById('btn_dev_add_close').addEventListener('click', closeModal);
    document.getElementById('btn_dev_add_cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    const clear_da_fields = () => {
        document.getElementById('da_ip').value = '';
        document.getElementById('da_devkey').value = '';
        document.getElementById('da_token').value = '';
        document.getElementById('da_server').value = '';
        document.getElementById('da_port').value = '';
        clearMsg('#lb_da_msg');
    };

    const setupAddModal = (type) => {
        dev_add_by = type;
        const isIp = type === 'ip';
        document.querySelectorAll('.daip').forEach(el => el.style.display = isIp ? 'block' : 'none');
        document.querySelectorAll('.dacld').forEach(el => el.style.display = isIp ? 'none' : 'block');

        clear_da_fields();

        if(type === 'blynk') {
            document.getElementById('lb_cld_token').textContent = 'Blynk';
            document.getElementById('lb_cld_server').textContent = 'Blynk';
            document.getElementById('da_server').value = 'blynk.openthings.io';
            document.getElementById('da_port').value = 9443;
        } else if (type === 'otc') {
            document.getElementById('lb_cld_token').textContent = 'OTC';
            document.getElementById('lb_cld_server').textContent = 'OTC';
            document.getElementById('da_server').value = 'cloud.openthings.io';
            document.getElementById('da_port').value = 443;
        }

        document.getElementById('dev_addmenu').style.display = 'none';
        openModal();
    };

    document.getElementById('btn_dev_add_by_ip').addEventListener('click', (e) => { e.preventDefault(); setupAddModal('ip'); });
    document.getElementById('btn_dev_add_by_blynk').addEventListener('click', (e) => { e.preventDefault(); setupAddModal('blynk'); });
    document.getElementById('btn_dev_add_by_otc').addEventListener('click', (e) => { e.preventDefault(); setupAddModal('otc'); });

    document.getElementById('btn_dev_add_submit').addEventListener('click', () => {
        let config;
        if (dev_add_by === 'ip') {
            const ip = document.getElementById('da_ip').value.trim();
            if (!ip) return alert('Invalid IP!');
            const devkey = document.getElementById('da_devkey').value;
            if (!devkey && !confirm('Device key is empty, are you sure?')) return;
            config = { 'ip': ip, 'devkey': devkey };
        } else if (dev_add_by === 'blynk' || dev_add_by === 'otc') {
            const token = document.getElementById('da_token').value.trim();
            if (token.length < 32) return alert('Invalid token length!');
            const server = document.getElementById('da_server').value.trim();
            if (!server) return alert('Invalid server!');
            const port = parseInt(document.getElementById('da_port').value, 10);
            if (isNaN(port) || port < 1 || port > 65535) return alert('Invalid port!');
            config = { 'token': token, 'server': server, 'port': port };
        } else {
            return alert('Invalid add method');
        }

        Object.assign(config, { type: dev_add_by, name: 'OG', door: -1, car: -1, dist: -1 });

        showMsg('#lb_da_msg', 'Connecting...', 0, 'green');
        document.querySelectorAll('.dabtn').forEach(b => b.disabled = true);

        const add_new_dev = (conf) => {
            devlist.push(conf);
            save_localStorage();
            document.getElementById('ndevs').textContent = devlist.length;
            sync_table_to_devlist();
            update_tr(devlist.length - 1, 1);
            closeModal();
        };

        connect_device(config, 'JSON', (result) => {
            if (typeof result.name === 'string') {
                config.name = result.name;
            }
            add_new_dev(config);
        }, () => {
            if (confirm('Failed to connect. Add device anyway?')) {
                add_new_dev(config);
            }
        }, -1, (config.type === 'blynk' ? '/project' : '/jc'))
        .finally(() => {
            document.querySelectorAll('.dabtn').forEach(b => b.disabled = false);
            clearMsg('#lb_da_msg');
        });
    });

    // --- Page Change Logic ---
    const handlePageDevicesShow = () => {
        if (tm_currdev) { clearInterval(tm_currdev); tm_currdev = null; }
        setTimeout(update_status, 100);
        tm_devices = setInterval(update_status, 5000);
    };

    const handlePageCurrDevShow = () => {
        if (currdev < 0 || currdev >= devlist.length) {
            // Invalid state, go back to list
            showPage('page_devices');
            handlePageDevicesShow();
            return;
        }
        if (tm_devices) { clearInterval(tm_devices); tm_devices = null; }
        config_currdev = { ...devlist[currdev] }; // Make a copy
        config_currdev.door = -1; // Force refresh

        document.getElementById('btn_dev_home').disabled = config_currdev.type === 'blynk';
        document.getElementById('lbl_currdev').textContent = conf2str_short(config_currdev);

        setTimeout(update_status_currdev, 100);
        tm_currdev = setInterval(update_status_currdev, 2000);
    };

    // --- Initialization ---
    load_localStorage();
    if (currdev < 0 || currdev >= devlist.length) {
        showPage('page_devices');
        handlePageDevicesShow();
    } else {
        showPage('page_currdev');
        handlePageCurrDevShow();
    }
});