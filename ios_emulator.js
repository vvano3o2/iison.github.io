document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. STATE MANAGEMENT
    // ==========================================
    const userState = {
        name: 'iis',
        phone: '13800000000',
        persona: 'Default User',
        avatarUrl: null
    };
    window.userState = userState;

    let accounts = [
        { id: 1, name: 'iis', phone: '13800000000', signature: 'Default User', persona: 'Default User', avatarUrl: null },
        { id: 2, name: 'User2', phone: '13912345678', signature: 'Work Persona', persona: 'Work Persona', avatarUrl: null }
    ];
    let currentAccountId = 1;
    
    // Detail View temp state
    let isCreatingNewAccount = false;
    let detailTempId = null;

    // API State
    let apiConfig = { endpoint: '', apiKey: '', model: 'gpt-3.5-turbo', temperature: 0.7 };
    
    // Load saved API config if exists
    try {
        const savedApi = localStorage.getItem('emulator_api_config');
        if (savedApi) {
            apiConfig = { ...apiConfig, ...JSON.parse(savedApi) };
        }
    } catch(e) { console.error('Failed to load api config', e); }
    
    window.apiConfig = apiConfig;

    let apiPresets = [
        { id: 1, name: 'Localhost', endpoint: 'http://localhost:5000', apiKey: 'sk-12345', model: 'llama-2', temp: 0.7 },
        { id: 2, name: 'OpenAI', endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4', temp: 1.0 }
    ];
    let fetchedModels = [];
    
    // Load saved fetched models if exists
    try {
        const savedModels = localStorage.getItem('emulator_api_models');
        if (savedModels) {
            fetchedModels = JSON.parse(savedModels);
        } else {
            fetchedModels = ['gpt-3.5-turbo', 'gpt-4', 'claude-v1'];
        }
    } catch(e) {}

    // Theme State
    let themeState = {
        bgUrl: null,
        apps: [
            { id: 'app-icon-1', name: 'App 1', icon: null },
            { id: 'app-icon-2', name: 'App 2', icon: null },
            { id: 'app-icon-3', name: 'App 3', icon: null },
            { id: 'app-icon-4', name: 'App 4', icon: null },
            { id: 'dock-icon-settings', name: 'Settings', icon: null },
            { id: 'dock-icon-imessage', name: 'iMessage', icon: null },
            { id: 'dock-icon-youtube', name: 'YouTube', icon: null }
        ]
    };
    let currentEditingAppIndex = -1;

    // World Book State (CLEARED as requested)
    let wbGroups = []; // Empty initially
    let worldBooks = []; // Empty initially
    window.getWorldBooks = () => worldBooks; // Export for imessage.js
    let editingBookId = null; // For edit mode
    let tempEntries = []; // For add/edit modal: [{id, keyword, content}]
    let activeEntryId = null; // Currently selected chip

    // ==========================================
    // 2. DOM ELEMENTS
    // ==========================================
    const UI = {
        views: {
            settings: document.getElementById('settings-view'),
            edit: document.getElementById('edit-view'), // Apple ID Profile View
            worldBook: document.getElementById('world-book-view')
        },
        overlays: {
            accountSwitcher: document.getElementById('account-sheet-overlay'),
            personaDetail: document.getElementById('persona-detail-sheet'),
            apiConfig: document.getElementById('api-config-sheet'),
            themeConfig: document.getElementById('theme-config-sheet'),
            addFriend: document.getElementById('add-friend-sheet'),
            savePreset: document.getElementById('save-preset-name-sheet'),
            loadPreset: document.getElementById('load-preset-list-sheet'),
            modelPicker: document.getElementById('model-picker-sheet'),
            addGroup: document.getElementById('add-group-overlay'),
            addBook: document.getElementById('add-book-overlay'), // Also used for Edit
            bookGroupPicker: document.getElementById('book-group-picker-sheet')
        },
        displays: {
            homeName: document.querySelector('.username'),
            homeAvatarImg: createOrGetImg(document.querySelector('.avatar')),
            homeAvatarIcon: document.querySelector('.avatar i'),
            
            settingsName: document.getElementById('settings-name'),
            settingsAvatarImg: document.getElementById('settings-avatar-img'),
            settingsAvatarIcon: document.querySelector('.apple-id-avatar-small i'),

            displayName: document.getElementById('display-name'),
            displayPhone: document.getElementById('display-phone'),
            editAvatarImg: document.getElementById('edit-avatar-img'),
            editAvatarIcon: document.querySelector('#edit-avatar-preview i'),
        },
        inputs: {
            detailName: document.getElementById('detail-name-input'),
            detailPhone: document.getElementById('detail-phone-input'),
            detailSignature: document.getElementById('detail-signature-input'),
            detailPersona: document.getElementById('detail-persona-input'),
            detailAvatarImg: document.getElementById('detail-avatar-img'),
            detailAvatarIcon: document.querySelector('#detail-avatar-preview i'),
            
            friendRealName: document.getElementById('friend-realname-input'),
            friendNickname: document.getElementById('friend-nickname-input'),
            friendSignature: document.getElementById('friend-signature-input'),
            friendPersona: document.getElementById('friend-persona-input'),
            friendAvatarImg: document.getElementById('friend-avatar-img'),
            friendAvatarIcon: document.querySelector('#friend-avatar-preview i'),

            apiEndpoint: document.getElementById('api-endpoint-input'),
            apiKey: document.getElementById('api-key-input'),
            apiTemp: document.getElementById('api-temp-input'),
            apiModel: document.getElementById('api-model-input'),
            presetName: document.getElementById('preset-name-input'),
            
            themeBgUrl: document.getElementById('theme-bg-url-input'),
            themeAppList: document.getElementById('theme-app-list')
        },
        lists: {
            accounts: document.getElementById('account-list'),
            presets: document.getElementById('preset-list'),
            models: document.getElementById('model-list')
        }
    };
    window.UI = UI;

    // --- Helper: Get/Create Avatar Img Tag ---
    function createOrGetImg(parent) {
        if (!parent) return null;
        let img = parent.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.style.display = 'none';
            parent.appendChild(img);
        }
        return img;
    }

    // ==========================================
    // 3. UTILITY FUNCTIONS
    // ==========================================
    function openView(viewElement) {
        if(viewElement) viewElement.classList.add('active');
    }

    function closeView(viewElement) {
        if(viewElement) viewElement.classList.remove('active');
    }
    window.openView = openView;
    window.closeView = closeView;

    // Bind overlay click-to-close automatically
    Object.values(UI.overlays).forEach(overlay => {
        if(overlay) {
            overlay.addEventListener('mousedown', (e) => {
                if (e.target === overlay) closeView(overlay);
            });
        }
    });

    // --- Custom Modal System ---
    window.showCustomModal = function(options) {
        const overlay = document.getElementById('custom-modal-overlay');
        if (!overlay) return;

        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        
        if (titleEl) titleEl.textContent = options.title || '提示';
        if (messageEl) messageEl.textContent = options.message || '';
        
        if (cancelBtn) {
            cancelBtn.textContent = options.cancelText || '取消';
            cancelBtn.onclick = () => {
                closeView(overlay);
                if (options.onCancel) options.onCancel();
            };
        }
        
        if (confirmBtn) {
            confirmBtn.textContent = options.confirmText || '确定';
            if (options.isDestructive) {
                confirmBtn.style.color = '#ff3b30';
            } else {
                confirmBtn.style.color = '#007aff';
            }
            confirmBtn.onclick = () => {
                closeView(overlay);
                if (options.onConfirm) options.onConfirm();
            };
        }

        // Handle prompt vs confirm
        const promptContent = document.getElementById('modal-prompt-content');
        const confirmContent = document.getElementById('modal-confirm-content');
        const promptConfirmBtn = document.getElementById('modal-prompt-confirm-btn');
        const modalInput = document.getElementById('modal-input');

        if (options.type === 'prompt') {
            if (promptContent) promptContent.style.display = 'block';
            if (confirmContent) confirmContent.style.display = 'none';
            if (confirmBtn) confirmBtn.style.display = 'none';
            if (promptConfirmBtn) {
                promptConfirmBtn.style.display = 'block';
                promptConfirmBtn.textContent = options.confirmText || '确定';
                promptConfirmBtn.onclick = () => {
                    closeView(overlay);
                    if (options.onConfirm) options.onConfirm(modalInput ? modalInput.value : '');
                };
            }
            if (modalInput) {
                modalInput.placeholder = options.placeholder || '请输入';
                modalInput.value = options.defaultValue || '';
            }
        } else {
            if (promptContent) promptContent.style.display = 'none';
            if (confirmContent) confirmContent.style.display = 'block';
            if (confirmBtn) confirmBtn.style.display = 'block';
            if (promptConfirmBtn) promptConfirmBtn.style.display = 'none';
        }

        openView(overlay);
    };

    // --- Toast Notification System ---
    let toastTimeout = null;
    function showToast(message, duration = 2000) {
        let toast = document.getElementById('global-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'global-toast';
            toast.className = 'toast-bubble';
            // Append to screen container to stay within phone frame
            const screen = document.querySelector('.screen');
            if (screen) {
                screen.appendChild(toast);
            } else {
                document.body.appendChild(toast);
            }
        }

        toast.textContent = message;
        toast.classList.remove('show');
        
        // Force reflow
        void toast.offsetWidth;
        
        toast.classList.add('show');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
    window.showToast = showToast;

    // Handle generic swipe logic for any list
    function addSwipeLogic(card, onDelete) {
        let startX = 0, isDragging = false;
        
        // Find existing swiped card in the same list to close it
        const list = card.parentElement;

        const startSwipe = (x) => { startX = x; isDragging = true; };
        const moveSwipe = (x) => {
            if (!isDragging) return;
            const diff = startX - x;
            
            if (diff > 40) { 
                // Close others
                const others = list.querySelectorAll('.account-card.swiped');
                others.forEach(o => { if(o !== card) o.classList.remove('swiped') });
                
                card.classList.add('swiped');
                isDragging = false;
            } else if (diff < -40) { 
                card.classList.remove('swiped');
                isDragging = false;
            }
        };
        const endSwipe = () => { isDragging = false; };

        card.addEventListener('mousedown', (e) => startSwipe(e.clientX));
        card.addEventListener('mousemove', (e) => moveSwipe(e.clientX));
        card.addEventListener('mouseup', endSwipe);
        card.addEventListener('mouseleave', endSwipe);
        card.addEventListener('touchstart', (e) => startSwipe(e.touches[0].clientX));
        card.addEventListener('touchmove', (e) => moveSwipe(e.touches[0].clientX));
        card.addEventListener('touchend', endSwipe);

        // Delete Action
        card.querySelector('.delete-action').addEventListener('click', (e) => {
            e.stopPropagation();
            onDelete();
        });
    }

    // ==========================================
    // 4. CORE SYSTEM LOGIC
    // ==========================================
    // Clock
    function updateClock() {
        const now = new Date();
        const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        document.getElementById('clock').textContent = timeString;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Music Player Toggle
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playBtn.classList.toggle('fa-play');
            playBtn.classList.toggle('fa-pause');
        });
    }

    // Phone Input Restriction
    if (UI.inputs.detailPhone) {
        UI.inputs.detailPhone.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 11);
        });
    }

    // ==========================================
    // 5. NAVIGATION EVENT LISTENERS
    // ==========================================
    // Main Settings
    document.querySelector('.dock-icon:nth-child(1)').addEventListener('click', () => {
        syncUIs();
        openView(UI.views.settings);
    });
    document.getElementById('settings-title-back-btn').addEventListener('click', () => closeView(UI.views.settings));

    // Use Home Bar to close apps
    document.getElementById('home-bar').addEventListener('click', () => {
        closeView(UI.views.settings);
        closeView(UI.views.edit);
        closeView(UI.views.worldBook);
        // imessageView is handled in imessage.js now
        const imessageView = document.getElementById('imessage-view');
        if (imessageView) closeView(imessageView);
    });

    // ==========================================
    // World Book Logic
    // ==========================================
    const wbMainBtn = document.getElementById('world-book-main-btn');
    if (wbMainBtn) {
        wbMainBtn.addEventListener('click', () => {
            renderWorldBooks();
            openView(UI.views.worldBook);
        });
    }

    const wbBackBtn = document.getElementById('world-book-back-btn');
    if (wbBackBtn) {
        wbBackBtn.addEventListener('click', () => {
            closeView(UI.views.worldBook);
        });
    }

    // Tabs logic
    const wbSegmentBtns = document.querySelectorAll('.wb-segment-btn');
    const wbTabContents = document.querySelectorAll('.wb-tab-content');

    wbSegmentBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active from all
            wbSegmentBtns.forEach(b => b.classList.remove('active'));
            wbTabContents.forEach(c => c.style.display = 'none');
            
            // Add active to clicked
            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(`wb-tab-${targetTab}`);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        });
    });

    // Add Menu Logic
    const wbAddBtn = document.getElementById('world-book-add-btn');
    const wbAddMenu = document.getElementById('wb-add-menu');
    
    if (wbAddBtn && wbAddMenu) {
        wbAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            wbAddMenu.style.display = wbAddMenu.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', (e) => {
            if (wbAddMenu.style.display === 'block' && !wbAddMenu.contains(e.target) && e.target !== wbAddBtn) {
                wbAddMenu.style.display = 'none';
            }
        });
    }

    // Add Group
    const btnAddGroup = document.getElementById('wb-add-group-btn');
    if (btnAddGroup) {
        btnAddGroup.addEventListener('click', () => {
            wbAddMenu.style.display = 'none';
            document.getElementById('add-group-name-input').value = '';
            openView(UI.overlays.addGroup);
        });
    }

    const confirmAddGroupBtn = document.getElementById('confirm-add-group-btn');
    if (confirmAddGroupBtn) {
        confirmAddGroupBtn.addEventListener('click', () => {
            const nameInput = document.getElementById('add-group-name-input');
            const name = nameInput.value.trim();
            if (name) {
                if (!wbGroups.includes(name)) {
                    wbGroups.push(name);
                    renderWorldBooks(); // This will refresh the 'All' list
                    showToast('分组已添加');
                } else {
                    showToast('分组已存在');
                }
                nameInput.value = ''; // Clear input
            }
            closeView(UI.overlays.addGroup);
        });
    }

    // Add / Edit Book Logic
    const btnAddBook = document.getElementById('wb-add-book-btn');
    const addEntryBtn = document.getElementById('add-book-entry-btn');
    
    // New Buttons
    const wbEditActions = document.getElementById('wb-edit-actions');
    const deleteWorldBookBtn = document.getElementById('delete-world-book-btn');
    const wbImportBtn = document.getElementById('wb-import-btn');
    const wbExportBtn = document.getElementById('wb-export-btn');
    const wbImportFile = document.getElementById('wb-import-file');

    if (btnAddBook) {
        btnAddBook.addEventListener('click', () => {
            wbAddMenu.style.display = 'none';
            openBookModal(); // Open in create mode
        });
    }

    function openBookModal(book = null) {
        // Reset state
        if (book) {
            editingBookId = book.id;
            document.querySelector('#add-book-overlay .sheet-title').textContent = '编辑世界书';
            document.getElementById('add-book-name-input').value = book.name;
            document.getElementById('add-book-group-input').value = book.group;
            
            // Show Edit Actions
            if(wbEditActions) wbEditActions.style.display = 'flex';
            if(deleteWorldBookBtn) deleteWorldBookBtn.style.display = 'flex';

            // Clone entries deeply to avoid reference issues
            tempEntries = book.entries.map((e, idx) => ({ id: Date.now() + idx, keyword: e.keyword, content: e.content }));
            
            if (tempEntries.length > 0) {
                activeEntryId = tempEntries[0].id;
                renderEntries();
            } else {
                addEntry();
            }
        } else {
            editingBookId = null;
            document.querySelector('#add-book-overlay .sheet-title').textContent = '添加新书';
            document.getElementById('add-book-name-input').value = '';
            document.getElementById('add-book-group-input').value = '未分组';
            
            // Hide Edit Actions
            if(wbEditActions) wbEditActions.style.display = 'none';
            if(deleteWorldBookBtn) deleteWorldBookBtn.style.display = 'none';

            tempEntries = [];
            // Add initial empty entry
            addEntry();
        }
        
        openView(UI.overlays.addBook);
    }

    // Delete Logic
    if (deleteWorldBookBtn) {
        deleteWorldBookBtn.addEventListener('click', () => {
            if (!editingBookId) return;
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '删除世界书',
                    message: '确定要删除这本世界书吗？此操作不可恢复。',
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: () => {
                        worldBooks = worldBooks.filter(b => b.id !== editingBookId);
                        renderWorldBooks();
                        closeView(UI.overlays.addBook);
                        showToast('世界书已删除');
                    }
                });
            } else {
                if (confirm('确定要删除这本世界书吗？此操作不可恢复。')) {
                    worldBooks = worldBooks.filter(b => b.id !== editingBookId);
                    renderWorldBooks();
                    closeView(UI.overlays.addBook);
                    showToast('世界书已删除');
                }
            }
        });
    }

    // Export Logic
    if (wbExportBtn) {
        wbExportBtn.addEventListener('click', () => {
            if (!editingBookId) return;
            const book = worldBooks.find(b => b.id === editingBookId);
            if (book) {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(book, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", (book.name || "worldbook") + ".json");
                document.body.appendChild(downloadAnchorNode); // required for firefox
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            }
        });
    }

    // Import Logic
    if (wbImportBtn && wbImportFile) {
        wbImportBtn.addEventListener('click', () => {
            wbImportFile.click();
        });

        wbImportFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedBook = JSON.parse(event.target.result);
                    
                    // Fill inputs
                    if (importedBook.name) document.getElementById('add-book-name-input').value = importedBook.name;
                    if (importedBook.group) document.getElementById('add-book-group-input').value = importedBook.group;
                    
                    // Fill entries
                    if (importedBook.entries && Array.isArray(importedBook.entries)) {
                        tempEntries = importedBook.entries.map((e, idx) => ({ 
                            id: Date.now() + idx, 
                            keyword: e.keyword, 
                            content: e.content 
                        }));
                        if (tempEntries.length > 0) activeEntryId = tempEntries[0].id;
                        renderEntries();
                        showToast('导入成功');
                    }
                } catch (err) {
                    console.error(err);
                    showToast('导入失败：格式错误');
                }
            };
            reader.readAsText(file);
            e.target.value = ''; // Reset
        });
    }

    function addEntry() {
        const newEntry = {
            id: Date.now(),
            keyword: `词条${tempEntries.length + 1}`,
            content: ''
        };
        tempEntries.push(newEntry);
        activeEntryId = newEntry.id;
        renderEntries();
    }

    function deleteEntry(id, e) {
        e.stopPropagation();
        tempEntries = tempEntries.filter(ent => ent.id !== id);
        if (activeEntryId === id) {
            activeEntryId = null;
        }
        renderEntries();
    }

    function renderEntries() {
        const listContainer = document.getElementById('wb-entries-list-container');
        if(!listContainer) return;
        listContainer.innerHTML = '';
        
        tempEntries.forEach(entry => {
            const isExpanded = entry.id === activeEntryId;
            const item = document.createElement('div');
            item.className = `wb-entry-item ${isExpanded ? 'expanded' : ''}`;
            
            item.innerHTML = `
                <div class="wb-entry-header">
                    <span class="wb-entry-title">${entry.keyword || '未命名词条'}</span>
                    <div class="wb-entry-actions">
                        <i class="fas fa-trash wb-entry-delete-btn"></i>
                        <i class="fas fa-chevron-down wb-entry-toggle-icon"></i>
                    </div>
                </div>
                <div class="wb-entry-body">
                    <input type="text" class="wb-entry-body-input" placeholder="关键词 (Key)" value="${entry.keyword}">
                    <textarea class="wb-entry-body-textarea" placeholder="输入详细设定内容...">${entry.content}</textarea>
                </div>
            `;
            
            const header = item.querySelector('.wb-entry-header');
            const deleteBtn = item.querySelector('.wb-entry-delete-btn');
            const keyInput = item.querySelector('.wb-entry-body-input');
            const contentInput = item.querySelector('.wb-entry-body-textarea');
            
            header.addEventListener('click', (e) => {
                if(e.target === deleteBtn || deleteBtn.contains(e.target)) return;
                // Toggle expand
                if (activeEntryId === entry.id) {
                    activeEntryId = null; // collapse
                } else {
                    activeEntryId = entry.id; // expand
                }
                renderEntries();
            });
            
            deleteBtn.addEventListener('click', (e) => {
                deleteEntry(entry.id, e);
            });
            
            keyInput.addEventListener('input', (e) => {
                entry.keyword = e.target.value;
                item.querySelector('.wb-entry-title').textContent = entry.keyword || '未命名词条';
            });
            
            contentInput.addEventListener('input', (e) => {
                entry.content = e.target.value;
            });
            
            listContainer.appendChild(item);
        });
    }

    if (addEntryBtn) {
        addEntryBtn.addEventListener('click', addEntry);
    }

    // Group Picker for Add Book
    const groupSelector = document.getElementById('book-group-selector');
    if (groupSelector) {
        groupSelector.addEventListener('click', () => {
            renderBookGroupPicker();
            openView(UI.overlays.bookGroupPicker);
        });
    }

    document.getElementById('close-book-group-picker-btn').addEventListener('click', () => {
        closeView(UI.overlays.bookGroupPicker);
    });

    function renderBookGroupPicker() {
        const list = document.getElementById('book-group-list');
        list.innerHTML = '';
        
        const allGroups = ['未分组', ...wbGroups];
        allGroups.forEach(g => {
            const item = document.createElement('div');
            item.className = 'account-card';
            item.innerHTML = `
                <div class="account-content" style="cursor: pointer; justify-content: center;">
                    <div class="account-name">${g}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                document.getElementById('add-book-group-input').value = g;
                closeView(UI.overlays.bookGroupPicker);
            });
            list.appendChild(item);
        });
    }

    // Confirm Add/Edit Book
    const confirmAddBookBtn = document.getElementById('confirm-add-book-btn');
    if (confirmAddBookBtn) {
        confirmAddBookBtn.addEventListener('click', () => {
            const name = document.getElementById('add-book-name-input').value.trim() || '未命名世界书';
            const group = document.getElementById('add-book-group-input').value;
            
            // Clean up entries (remove id used for UI)
            const finalEntries = tempEntries.map(e => ({ keyword: e.keyword, content: e.content }));

            if (editingBookId) {
                // Update existing
                const book = worldBooks.find(b => b.id === editingBookId);
                if (book) {
                    book.name = name;
                    book.group = group;
                    book.entries = finalEntries;
                    showToast('世界书已更新');
                }
            } else {
                // Create new
                worldBooks.push({
                    id: Date.now(),
                    name,
                    group: group === '未分组' ? '未分组' : group,
                    entries: finalEntries,
                    isGlobal: false,
                    attachedRoles: []
                });
                showToast('世界书已添加');
            }

            renderWorldBooks();
            closeView(UI.overlays.addBook);
        });
    }

    // Render World Books Helper
    function calculateTokens(entries) {
        // Very rough mock token calculation
        let text = entries.map(e => e.keyword + e.content).join('');
        return Math.ceil(text.length * 1.5) || 0;
    }
    window.calculateTokens = calculateTokens; // Export for imessage.js

    function createBookHtml(book, type) {
        let rightElementHtml = '';
        const tokens = calculateTokens(book.entries);

        if (type === 'all' || type === 'global') {
            rightElementHtml = `
                <div class="wb-book-meta">
                    <span class="wb-token-count">+${tokens} Tokens</span>
                    <label class="toggle-switch">
                        <input type="checkbox" class="wb-global-toggle" data-id="${book.id}" ${book.isGlobal ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            `;
        } else if (type === 'local') {
            const avatarSrc = book.attachedRoles[0]?.avatarUrl || '';
            const avatarInner = avatarSrc ? `<img src="${avatarSrc}">` : `<i class="fas fa-user"></i>`;
            rightElementHtml = `
                <div class="wb-book-meta">
                    <span class="wb-token-count">+${tokens} Tokens</span>
                    <div class="wb-char-avatar">${avatarInner}</div>
                </div>
            `;
        }

        return `
            <div class="wb-book-item" data-id="${book.id}">
                <div class="wb-book-info">
                    <div class="wb-book-icon" style="background-color: #1c1c1e;"><i class="fas fa-book"></i></div>
                    <div class="wb-book-name">${book.name}</div>
                </div>
                ${rightElementHtml}
            </div>
        `;
    }

    function renderWorldBooks() {
        // Render All Tab
        const allList = document.getElementById('wb-all-list');
        if (!allList) return;
        allList.innerHTML = '';
        
        // Render Groups
        wbGroups.forEach(groupName => {
            const booksInGroup = worldBooks.filter(b => b.group === groupName);
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'wb-group-container';
            
            const booksHtml = booksInGroup.map(b => createBookHtml(b, 'all')).join('');
            
            groupDiv.innerHTML = `
                <div class="wb-group-header">
                    <div class="wb-group-title">${groupName} <span style="color:#8e8e93; font-weight:normal; font-size:14px; margin-left:5px;">(${booksInGroup.length})</span></div>
                    <i class="fas fa-chevron-down toggle-icon" style="color: #c7c7cc; transition: transform 0.3s;"></i>
                </div>
                <div class="wb-group-content open">
                    ${booksHtml}
                </div>
            `;
            
            // Toggle fold
            const header = groupDiv.querySelector('.wb-group-header');
            const content = groupDiv.querySelector('.wb-group-content');
            const icon = groupDiv.querySelector('.toggle-icon');
            header.addEventListener('click', () => {
                content.classList.toggle('open');
                if (content.classList.contains('open')) {
                    icon.style.transform = 'rotate(0deg)';
                } else {
                    icon.style.transform = 'rotate(-90deg)';
                }
            });

            allList.appendChild(groupDiv);
        });

        // Render Ungrouped
        const unGroupedBooks = worldBooks.filter(b => b.group === '未分组');
        if (unGroupedBooks.length > 0) {
            const unGroupDiv = document.createElement('div');
            unGroupDiv.className = 'wb-group-container';
            const booksHtml = unGroupedBooks.map(b => createBookHtml(b, 'all')).join('');
            unGroupDiv.innerHTML = `
                <div class="wb-group-header">
                    <div class="wb-group-title">未分组 <span style="color:#8e8e93; font-weight:normal; font-size:14px; margin-left:5px;">(${unGroupedBooks.length})</span></div>
                    <i class="fas fa-chevron-down toggle-icon" style="color: #c7c7cc;"></i>
                </div>
                <div class="wb-group-content open">
                    ${booksHtml}
                </div>
            `;
            // Toggle fold
            const header = unGroupDiv.querySelector('.wb-group-header');
            const content = unGroupDiv.querySelector('.wb-group-content');
            const icon = unGroupDiv.querySelector('.toggle-icon');
            header.addEventListener('click', () => {
                content.classList.toggle('open');
                icon.style.transform = content.classList.contains('open') ? 'rotate(0deg)' : 'rotate(-90deg)';
            });

            allList.appendChild(unGroupDiv);
        }

        // Render Global Tab
        const globalList = document.getElementById('wb-global-list');
        if (globalList) {
            const globalBooks = worldBooks.filter(b => b.isGlobal);
            globalList.innerHTML = `<div style="padding: 10px 16px;">
                ${globalBooks.map(b => createBookHtml(b, 'global')).join('')}
            </div>`;
        }

        // Render Local Tab
        const localList = document.getElementById('wb-local-list');
        if (localList) {
            let localItemsHtml = '';
            
            // Get friends from imessage.js via global export if available
            const friends = window.getImFriends ? window.getImFriends() : [];
            
            worldBooks.forEach(book => {
                // Find all friends that have bound this book
                const boundFriends = friends.filter(f => f.boundBooks && f.boundBooks.includes(book.id));
                
                boundFriends.forEach(friend => {
                    const tokens = window.calculateTokens(book.entries);
                    const avatarSrc = friend.avatarUrl || '';
                    const avatarInner = avatarSrc ? `<img src="${avatarSrc}">` : `<i class="fas fa-user"></i>`;
                    
                    const rightElementHtml = `
                        <div class="wb-book-meta">
                            <span class="wb-token-count">+${tokens} Tokens</span>
                            <div class="wb-char-avatar">${avatarInner}</div>
                        </div>
                    `;
                    
                    localItemsHtml += `
                        <div class="wb-book-item" data-id="${book.id}">
                            <div class="wb-book-info">
                                <div class="wb-book-icon"><i class="fas fa-book"></i></div>
                                <div class="wb-book-name">${book.name}</div>
                            </div>
                            ${rightElementHtml}
                        </div>
                    `;
                });
            });
            
            if (localItemsHtml === '') {
                localList.innerHTML = `<div style="padding: 40px 16px; text-align: center; color: #8e8e93; font-size: 15px;">暂无绑定</div>`;
            } else {
                localList.innerHTML = `<div style="padding: 10px 16px; display: flex; flex-direction: column; gap: 10px;">
                    ${localItemsHtml}
                </div>`;
            }
        }
    }
    window.renderWorldBooks = renderWorldBooks; // Export for update

    // Global Click Listener for Edit Book (Event Delegation)
    document.addEventListener('click', (e) => {
        // Handle Edit Book Click
        const bookItem = e.target.closest('.wb-book-item');
        if (bookItem) {
            // Ensure we didn't click the toggle switch
            if (!e.target.closest('.toggle-switch')) {
                const bookId = parseInt(bookItem.getAttribute('data-id'));
                const book = worldBooks.find(b => b.id === bookId);
                if (book) {
                    if (wbAddMenu) wbAddMenu.style.display = 'none'; // Close menu if open
                    openBookModal(book);
                }
            }
        }
    });

    // Global Change Listener for Toggles
    document.addEventListener('change', (e) => {
        if (e.target && e.target.classList.contains('wb-global-toggle')) {
            const bookId = parseInt(e.target.getAttribute('data-id'));
            const book = worldBooks.find(b => b.id === bookId);
            if (book) {
                book.isGlobal = e.target.checked;
                
                // Sync UI: update all switches for this book
                document.querySelectorAll(`.wb-global-toggle[data-id="${bookId}"]`).forEach(s => {
                    s.checked = book.isGlobal;
                });

                // If in Global tab and unchecking, remove item with animation
                if (!book.isGlobal) {
                    const globalList = document.getElementById('wb-global-list');
                    // Check if the event came from inside global list
                    if (globalList && globalList.contains(e.target)) {
                        const row = e.target.closest('.wb-book-item');
                        if (row) {
                            row.classList.add('removing');
                            setTimeout(() => {
                                row.remove();
                            }, 300);
                        }
                    } else {
                        // Unchecked from All tab, just refresh global list silently
                        if (globalList) {
                            const globalBooks = worldBooks.filter(b => b.isGlobal);
                            globalList.innerHTML = `<div style="padding: 10px 16px;">
                                ${globalBooks.map(b => createBookHtml(b, 'global')).join('')}
                            </div>`;
                        }
                    }
                } else {
                    // Checked from All tab, add to global list
                    const globalList = document.getElementById('wb-global-list');
                    if (globalList) {
                        const globalBooks = worldBooks.filter(b => b.isGlobal);
                        globalList.innerHTML = `<div style="padding: 10px 16px;">
                            ${globalBooks.map(b => createBookHtml(b, 'global')).join('')}
                        </div>`;
                    }
                }
            }
        }
    });


    // --- Bottom Nav Logic moved to imessage.js to avoid conflicts ---
    
    // --- Chat Sending Logic (Shared Helper Functions if needed) ---
    const chatInput = document.getElementById('chat-message-input');
    const sendBtn = document.getElementById('send-msg-btn');
    const micBtn = document.getElementById('mic-msg-btn');
    const chatMessagesContainer = document.getElementById('ins-chat-messages');

    function scrollToBottom() {
        if (chatMessagesContainer) {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }
    }

    function appendUserMessage(msg) {
        if (!chatMessagesContainer) return;
        const row = document.createElement('div');
        row.className = 'chat-row user-row';
        row.innerHTML = `<div class="chat-bubble user-bubble">${msg}</div>`;
        chatMessagesContainer.appendChild(row);
        scrollToBottom();
    }

    function appendAiMessage(msg, friend) {
        if (!chatMessagesContainer) return;
        const row = document.createElement('div');
        row.className = 'chat-row ai-row';
        
        const avatarHtml = (friend && friend.avatarUrl) 
            ? `<img src="${friend.avatarUrl}">`
            : `<i class="fas fa-user"></i>`;

        row.innerHTML = `
            <div class="chat-avatar-small">${avatarHtml}</div>
            <div class="chat-bubble ai-bubble">${msg}</div>
        `;
        chatMessagesContainer.appendChild(row);
        scrollToBottom();
    }

    function appendAiTyping(friend) {
        if (!chatMessagesContainer) return null;
        const row = document.createElement('div');
        row.className = 'chat-row ai-row typing-row';
        
        const avatarHtml = (friend && friend.avatarUrl) 
            ? `<img src="${friend.avatarUrl}">`
            : `<i class="fas fa-user"></i>`;

        row.innerHTML = `
            <div class="chat-avatar-small">${avatarHtml}</div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        chatMessagesContainer.appendChild(row);
        scrollToBottom();
        return row;
    }

    function handleSendMessage() {
        if (!chatInput) return;
        const msg = chatInput.value.trim();
        if (msg) {
            appendUserMessage(msg);
            chatInput.value = '';
        }
    }

    async function handleAiGenerate() {
        if (!currentActiveFriend) {
            showToast('No active friend selected.');
            return;
        }
        
        if (!apiConfig.endpoint || !apiConfig.apiKey) {
            showToast('请先配置 API Endpoint 和 Key');
            return;
        }

        const typingRow = appendAiTyping(currentActiveFriend);
        if(micBtn) micBtn.style.opacity = '0.5';

        const systemPrompt = `You are playing the role of ${currentActiveFriend.realName || currentActiveFriend.nickname}. 
Your persona is: ${currentActiveFriend.persona || 'No specific persona'}. 
You are talking to ${userState.name}, whose persona is: ${userState.persona || 'A normal user'}.
Reply naturally as your character in a chat app. Do not include your own name at the beginning.`;

        const messages = [{ role: 'system', content: systemPrompt }];
        
        if (chatMessagesContainer) {
            const rows = chatMessagesContainer.querySelectorAll('.chat-row');
            const recentRows = Array.from(rows).slice(-10);
            recentRows.forEach(row => {
                if (row.classList.contains('typing-row')) return;
                const bubble = row.querySelector('.chat-bubble');
                if (bubble) {
                    if (row.classList.contains('user-row')) {
                        messages.push({ role: 'user', content: bubble.textContent });
                    } else if (row.classList.contains('ai-row')) {
                        messages.push({ role: 'assistant', content: bubble.textContent });
                    }
                }
            });
        }
        
        if (messages.length === 1) {
            messages.push({ role: 'user', content: '你好' });
        }

        try {
            let endpoint = apiConfig.endpoint;
            // 确保 endpoint 结尾没有 /，且自动补全 /chat/completions 或 /v1/chat/completions 
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: parseFloat(apiConfig.temperature) || 0.7
                })
            });

            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            
            const data = await response.json();
            const aiReply = data.choices[0].message.content;
            
            if (typingRow) typingRow.remove();
            appendAiMessage(aiReply, currentActiveFriend);

        } catch (error) {
            console.error(error);
            if (typingRow) typingRow.remove();
            showToast('API 请求失败，请检查配置或网络');
        } finally {
            if(micBtn) micBtn.style.opacity = '1';
        }
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }

    if (micBtn) {
        micBtn.addEventListener('click', handleAiGenerate);
    }

    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSendMessage();
            }
        });
    }

    // Apple ID Profile
    document.getElementById('apple-id-trigger').addEventListener('click', (e) => {
        e.stopPropagation(); 
        syncUIs();
        openView(UI.views.edit);
    });
    document.getElementById('edit-back-btn').addEventListener('click', () => closeView(UI.views.edit));

    // Main Edit Avatar Logic
    const mainEditAvatarWrapper = document.getElementById('main-edit-avatar-wrapper');
    const mainAvatarUpload = document.getElementById('main-avatar-upload');
    if (mainEditAvatarWrapper && mainAvatarUpload) {
        mainEditAvatarWrapper.addEventListener('click', () => {
            mainAvatarUpload.click();
        });

        mainAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const url = event.target.result;
                    // Update user state
                    userState.avatarUrl = url;
                    
                    // Update current account in accounts array
                    const acc = accounts.find(a => a.id === currentAccountId);
                    if (acc) {
                        acc.avatarUrl = url;
                    }
                    
                    // Sync the UI immediately
                    syncUIs();
                    showToast('头像已更新');
                };
                reader.readAsDataURL(file);
            }
            e.target.value = ''; // Reset
        });
    }

    // ==========================================
    // 6. ACCOUNT MANAGEMENT
    // ==========================================
    // Open Switcher
    document.getElementById('switch-account-btn').addEventListener('click', () => {
        renderAccountList();
        openView(UI.overlays.accountSwitcher);
    });

    // Add New Account
    document.getElementById('add-account-btn').addEventListener('click', () => {
        isCreatingNewAccount = true;
        detailTempId = Date.now();
        UI.inputs.detailName.value = '';
        UI.inputs.detailPhone.value = '';
        if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = '';
        UI.inputs.detailPersona.value = '';
        setDetailAvatar(null);
        openView(UI.overlays.personaDetail);
    });

    // Save Selected Account to Main State
    document.getElementById('save-id-btn').addEventListener('click', () => {
        const accToSync = accounts.find(a => a.id === currentAccountId);
        if (accToSync) {
            userState.name = accToSync.name;
            userState.phone = accToSync.phone;
            userState.persona = accToSync.signature || accToSync.persona; // Use signature for display
            userState.avatarUrl = accToSync.avatarUrl;
            syncUIs();
        }
        closeView(UI.overlays.accountSwitcher);
    });

    // Detail View Confirm
    document.getElementById('confirm-sync-btn').addEventListener('click', () => {
        const name = UI.inputs.detailName.value || 'New User';
        const phone = UI.inputs.detailPhone.value;
        const signature = UI.inputs.detailSignature ? UI.inputs.detailSignature.value : '';
        const persona = UI.inputs.detailPersona.value;
        const currentAvatarSrc = UI.inputs.detailAvatarImg.style.display === 'block' ? UI.inputs.detailAvatarImg.src : null;

        if (isCreatingNewAccount) {
            accounts.push({ id: detailTempId, name, phone, signature, persona, avatarUrl: currentAvatarSrc });
            currentAccountId = detailTempId; 
        } else {
            const acc = accounts.find(a => a.id === detailTempId);
            if (acc) {
                acc.name = name;
                acc.phone = phone;
                acc.signature = signature;
                acc.persona = persona;
                acc.avatarUrl = currentAvatarSrc;
            }
        }
        isCreatingNewAccount = false;
        renderAccountList(); 
        closeView(UI.overlays.personaDetail); 
    });

    // Avatar Upload Handler
    document.querySelector('.detail-avatar-wrapper').addEventListener('click', () => {
        document.getElementById('detail-avatar-upload').click();
    });

    document.getElementById('detail-avatar-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setDetailAvatar(e.target.result);
            reader.readAsDataURL(file);
        }
    });

    function setDetailAvatar(url) {
        if (url) {
            UI.inputs.detailAvatarImg.src = url;
            UI.inputs.detailAvatarImg.style.display = 'block';
            UI.inputs.detailAvatarIcon.style.display = 'none';
        } else {
            UI.inputs.detailAvatarImg.style.display = 'none';
            UI.inputs.detailAvatarIcon.style.display = 'block';
            UI.inputs.detailAvatarImg.src = '';
        }
    }

    function renderAccountList() {
        if(!UI.lists.accounts) return;
        UI.lists.accounts.innerHTML = '';

        accounts.forEach(acc => {
            const card = document.createElement('div');
            card.className = `account-card ${acc.id === currentAccountId ? 'selected' : ''}`;
            
            const avatarHtml = acc.avatarUrl ? `<img src="${acc.avatarUrl}" alt="">` : `<i class="fas fa-user"></i>`;
            card.innerHTML = `
                <div class="account-content">
                    <div class="account-avatar">${avatarHtml}</div>
                    <div class="account-info">
                        <div class="account-name">${acc.name}</div>
                        <div class="account-detail">${acc.phone || 'No Phone'}</div>
                    </div>
                    <i class="fas fa-times delete-icon"></i>
                </div>
            `;

            // Click to Open Detail View & Set Active
            card.querySelector('.account-content').addEventListener('click', (e) => {
                // If clicked on delete icon, do not open detail view
                if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                currentAccountId = acc.id;
                renderAccountList(); // Refresh highlighting
                
                isCreatingNewAccount = false;
                detailTempId = acc.id;
                UI.inputs.detailName.value = acc.name || '';
                UI.inputs.detailPhone.value = acc.phone || '';
                if(UI.inputs.detailSignature) UI.inputs.detailSignature.value = acc.signature || acc.persona || '';
                UI.inputs.detailPersona.value = acc.persona || '';
                setDetailAvatar(acc.avatarUrl);
                
                openView(UI.overlays.personaDetail);
            });

            // Delete Action
            card.querySelector('.delete-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete account "${acc.name}"?`)) {
                    accounts = accounts.filter(a => a.id !== acc.id);
                    if (currentAccountId === acc.id) currentAccountId = accounts.length > 0 ? accounts[0].id : null;
                    renderAccountList();
                }
            });

            UI.lists.accounts.appendChild(card);
        });
    }

    // ==========================================
    // 7. API CONFIGURATION
    // ==========================================
    // Open API Settings
    document.getElementById('api-config-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        UI.inputs.apiEndpoint.value = apiConfig.endpoint;
        UI.inputs.apiKey.value = apiConfig.apiKey;
        UI.inputs.apiModel.value = apiConfig.model;
        UI.inputs.apiTemp.value = apiConfig.temperature;
        openView(UI.overlays.apiConfig);
    });

    // Confirm API Settings
    document.getElementById('confirm-api-btn').addEventListener('click', () => {
        apiConfig.endpoint = UI.inputs.apiEndpoint.value;
        apiConfig.apiKey = UI.inputs.apiKey.value;
        apiConfig.model = UI.inputs.apiModel.value;
        apiConfig.temperature = parseFloat(UI.inputs.apiTemp.value) || 0.7;
        
        // Save to localStorage
        localStorage.setItem('emulator_api_config', JSON.stringify(apiConfig));
        window.apiConfig = apiConfig; // Update global
        
        closeView(UI.overlays.apiConfig);
        showToast('API Config Saved');
    });

    // Real Fetch Models Logic
    const btnApiFetch = document.getElementById('fetch-models-btn');
    btnApiFetch.addEventListener('click', async () => {
        const endpoint = UI.inputs.apiEndpoint.value.trim();
        const key = UI.inputs.apiKey.value.trim();
        
        if (!endpoint) {
            showToast('Please enter an endpoint');
            return;
        }

        const originalText = btnApiFetch.innerHTML;
        btnApiFetch.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        
        try {
            // Clean up endpoint to point to /v1/models
            let url = endpoint;
            if (url.endsWith('/')) url = url.slice(0, -1);
            if (!url.endsWith('/models')) {
                url = url.endsWith('/v1') ? url + '/models' : url + '/v1/models';
            }

            const headers = { 'Content-Type': 'application/json' };
            if (key) {
                headers['Authorization'] = `Bearer ${key}`;
            }

            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) throw new Error('Network response was not ok');
            
            const data = await res.json();
            
            if (data && data.data && Array.isArray(data.data)) {
                fetchedModels = data.data.map(m => m.id);
                // Save fetched models
                localStorage.setItem('emulator_api_models', JSON.stringify(fetchedModels));
                
                showToast(`Fetched ${fetchedModels.length} models!`);
            } else {
                throw new Error('Invalid format');
            }
        } catch (error) {
            console.error('Fetch Models Error:', error);
            showToast('Failed to fetch models');
        } finally {
            btnApiFetch.innerHTML = originalText;
        }
    });

    // -- Presets --
    // Open Save Preset
    document.getElementById('save-preset-btn').addEventListener('click', () => {
        UI.inputs.presetName.value = '';
        openView(UI.overlays.savePreset);
    });

    // Confirm Save Preset
    document.getElementById('confirm-save-preset-btn').addEventListener('click', () => {
        apiPresets.push({
            id: Date.now(),
            name: UI.inputs.presetName.value || 'Untitled Preset',
            endpoint: UI.inputs.apiEndpoint.value,
            apiKey: UI.inputs.apiKey.value,
            model: UI.inputs.apiModel.value,
            temp: UI.inputs.apiTemp.value
        });
        closeView(UI.overlays.savePreset);
    });

    // Open Load Preset
    document.getElementById('load-preset-btn').addEventListener('click', () => {
        renderPresetList();
        openView(UI.overlays.loadPreset);
    });

    function renderPresetList() {
        if(!UI.lists.presets) return;
        UI.lists.presets.innerHTML = '';
        
        apiPresets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'account-card'; 
            item.innerHTML = `
                <div class="account-content" style="cursor: pointer;">
                    <div class="account-avatar" style="background-color: var(--blue-color); color: white;"><i class="fas fa-server"></i></div>
                    <div class="account-info">
                        <div class="account-name">${preset.name}</div>
                        <div class="account-detail" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${preset.endpoint}</div>
                    </div>
                    <i class="fas fa-times delete-icon"></i>
                </div>
            `;
            
            item.querySelector('.account-content').addEventListener('click', (e) => {
                // If clicked on delete icon, do not load preset
                if (e.target.classList.contains('delete-icon') || e.target.closest('.delete-icon')) return;

                UI.inputs.apiEndpoint.value = preset.endpoint;
                UI.inputs.apiKey.value = preset.apiKey;
                UI.inputs.apiModel.value = preset.model || 'gpt-3.5-turbo';
                UI.inputs.apiTemp.value = preset.temp || 0.7;
                closeView(UI.overlays.loadPreset);
            });

            // Delete Action
            item.querySelector('.delete-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete preset "${preset.name}"?`)) {
                    apiPresets = apiPresets.filter(p => p.id !== preset.id);
                    renderPresetList();
                }
            });

            UI.lists.presets.appendChild(item);
        });
    }

    // -- Model Picker --
    UI.inputs.apiModel.addEventListener('click', () => {
        renderModelList();
        openView(UI.overlays.modelPicker);
    });

    function renderModelList() {
        if(!UI.lists.models) return;
        UI.lists.models.innerHTML = '';
        fetchedModels.forEach(model => {
            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div class="account-content">
                    <div class="account-info">
                        <div class="account-name" style="text-align:center;">${model}</div>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => {
                UI.inputs.apiModel.value = model;
                closeView(UI.overlays.modelPicker);
            });
            UI.lists.models.appendChild(item);
        });
    }


    // ==========================================
    // 8. THEME CONFIGURATION
    // ==========================================
    // Open Theme Settings
    document.getElementById('theme-config-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        renderThemeAppList();
        openView(UI.overlays.themeConfig);
    });

    // Theme Background Upload
    document.getElementById('theme-bg-upload-btn').addEventListener('click', () => {
        document.getElementById('theme-bg-file-input').click();
    });

    document.getElementById('theme-bg-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                UI.inputs.themeBgUrl.value = event.target.result;
                themeState.bgUrl = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Background URL Input Change
    UI.inputs.themeBgUrl.addEventListener('input', (e) => {
        themeState.bgUrl = e.target.value;
    });

    // Render App List for Customization
    function renderThemeAppList() {
        if (!UI.inputs.themeAppList) return;
        UI.inputs.themeAppList.innerHTML = '';

        themeState.apps.forEach((app, index) => {
            const item = document.createElement('div');
            item.className = 'form-item';
            // Custom styling for app item
            item.style.padding = '8px 16px';
            item.style.height = '60px';
            
            // Icon Preview (or placeholder)
            let iconHtml = '';
            if (app.icon) {
                iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-image: url('${app.icon}'); background-size: cover; background-position: center; border: 1px solid #e5e5ea;"></div>`;
            } else {
                iconHtml = `<div style="width: 40px; height: 40px; border-radius: 10px; background-color: #f2f2f7; border: 1px solid #e5e5ea; display: flex; align-items: center; justify-content: center; color: #c7c7cc;"><i class="fas fa-image"></i></div>`;
            }

            item.innerHTML = `
                <div style="display: flex; align-items: center; width: 100%;">
                    ${iconHtml}
                    <div style="margin-left: 12px; font-size: 17px; font-weight: 500; flex: 1;">${app.name}</div>
                    <div class="settings-icon action-icon-blue" style="margin: 0;"><i class="fas fa-upload"></i></div>
                </div>
            `;
            
            // Click to upload
            item.addEventListener('click', () => {
                currentEditingAppIndex = index;
                document.getElementById('theme-app-file-input').click();
            });

            UI.inputs.themeAppList.appendChild(item);
        });
    }

    // Handle App Icon File Selection
    document.getElementById('theme-app-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && currentEditingAppIndex >= 0) {
            const reader = new FileReader();
            reader.onload = (event) => {
                // Update state
                themeState.apps[currentEditingAppIndex].icon = event.target.result;
                // Re-render list to show preview
                renderThemeAppList();
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    });

    // Confirm Theme Settings
    document.getElementById('confirm-theme-btn').addEventListener('click', () => {
        // Apply Background
        const bgUrl = UI.inputs.themeBgUrl.value.trim() || themeState.bgUrl;
        const screenEl = document.querySelector('.screen');
        if (screenEl) {
            if (bgUrl) {
                // Remove nested quotes to avoid parsing errors with long base64 strings
                screenEl.style.backgroundImage = `url(${bgUrl})`;
                screenEl.style.backgroundSize = 'cover';
                screenEl.style.backgroundPosition = 'center';
            } else {
                screenEl.style.backgroundImage = 'none';
            }
        }

        // Apply App Icons
        themeState.apps.forEach(app => {
            const el = document.getElementById(app.id);
            if (el) {
                if (app.icon) {
                    el.style.backgroundImage = `url(${app.icon})`;
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                } else {
                    el.style.backgroundImage = '';
                }
            }
        });

        closeView(UI.overlays.themeConfig);
        showToast('主题已应用！');
    });

    // ==========================================
    // 9. SYNCHRONIZATION HELPERS
    // ==========================================
    window.syncUIs = function syncUIs() {
        // Sync Home Screen
        if(UI.displays.homeName) UI.displays.homeName.textContent = userState.name;
        
        if (userState.avatarUrl) {
            if(UI.displays.homeAvatarImg) {
                UI.displays.homeAvatarImg.src = userState.avatarUrl;
                UI.displays.homeAvatarImg.style.display = 'block';
            }
            if(UI.displays.homeAvatarIcon) UI.displays.homeAvatarIcon.style.display = 'none';
        } else {
            if(UI.displays.homeAvatarImg) UI.displays.homeAvatarImg.style.display = 'none';
            if(UI.displays.homeAvatarIcon) UI.displays.homeAvatarIcon.style.display = 'block';
        }
        
        // Sync Main Settings Profile Card
        if(UI.displays.settingsName) UI.displays.settingsName.textContent = userState.name;
        
        if (userState.avatarUrl) {
            if(UI.displays.settingsAvatarImg) {
                UI.displays.settingsAvatarImg.src = userState.avatarUrl;
                UI.displays.settingsAvatarImg.style.display = 'block';
            }
            if(UI.displays.settingsAvatarIcon) UI.displays.settingsAvatarIcon.style.display = 'none';
        } else {
            if(UI.displays.settingsAvatarImg) UI.displays.settingsAvatarImg.style.display = 'none';
            if(UI.displays.settingsAvatarIcon) UI.displays.settingsAvatarIcon.style.display = 'block';
        }
        
        // Sync Apple ID View
        if(UI.displays.displayName) UI.displays.displayName.textContent = userState.name;
        if(UI.displays.displayPhone) UI.displays.displayPhone.textContent = userState.phone || 'No Phone';
        
        const displaySignature = document.getElementById('display-signature');
        if(displaySignature) displaySignature.textContent = userState.persona || 'No Signature';

        if (userState.avatarUrl) {
            if(UI.displays.editAvatarImg) {
                UI.displays.editAvatarImg.src = userState.avatarUrl;
                UI.displays.editAvatarImg.style.display = 'block';
            }
            if(UI.displays.editAvatarIcon) UI.displays.editAvatarIcon.style.display = 'none';
        } else {
            if(UI.displays.editAvatarImg) UI.displays.editAvatarImg.style.display = 'none';
            if(UI.displays.editAvatarIcon) UI.displays.editAvatarIcon.style.display = 'block';
        }

        // Sync iMessage (LINE Style) Profile
        const imName = document.getElementById('imessage-profile-name');
        const imSign = document.getElementById('imessage-profile-sign');
        const imAvatarImg = document.getElementById('imessage-avatar-img');
        const imAvatarIcon = document.getElementById('imessage-avatar-icon');

        if (imName) imName.textContent = userState.name;
        if (imSign) imSign.textContent = userState.persona || 'No Persona';

        if (userState.avatarUrl) {
            if (imAvatarImg) {
                imAvatarImg.src = userState.avatarUrl;
                imAvatarImg.style.display = 'block';
            }
            if (imAvatarIcon) imAvatarIcon.style.display = 'none';
        } else {
            if (imAvatarImg) imAvatarImg.style.display = 'none';
            if (imAvatarIcon) imAvatarIcon.style.display = 'block';
        }
    }

    // Initial Bootstrap
    syncUIs();
});
