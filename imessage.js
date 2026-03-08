document.addEventListener('DOMContentLoaded', () => {
    // 引用全局变量
    const { UI, userState, apiConfig, openView, closeView, showToast, syncUIs } = window;

    // Custom Modal Logic
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalConfirmContent = document.getElementById('modal-confirm-content');
    const modalPromptContent = document.getElementById('modal-prompt-content');
    const modalMessage = document.getElementById('modal-message');
    const modalInput = document.getElementById('modal-input');
    
    // Buttons
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalPromptConfirmBtn = document.getElementById('modal-prompt-confirm-btn');

    let currentModalCallback = null;

    // Export for other modules
    window.showCustomModal = showCustomModal;
    window.closeCustomModal = closeCustomModal;

    function showCustomModal(options) {
        if (!customModalOverlay) return;
        
        modalTitle.textContent = options.title || '提示';
        currentModalCallback = options.onConfirm;

        // Reset
        if (options.type === 'prompt') {
            // Prompt mode uses modalPromptConfirmBtn (which is hidden by default)
            // But we want to reuse the same layout, so let's adjust visibility
            modalConfirmBtn.style.display = 'none';
            modalPromptConfirmBtn.style.display = 'block';
            
            modalConfirmContent.style.display = 'none';
            modalPromptContent.style.display = 'block';
            
            modalMessage.textContent = options.message || '';
            modalInput.value = options.defaultValue || '';
            modalInput.placeholder = options.placeholder || '';
            
            modalPromptConfirmBtn.textContent = options.confirmText || '确认';
        } else {
            // Confirm / Alert
            modalConfirmBtn.style.display = 'block';
            modalPromptConfirmBtn.style.display = 'none';
            
            modalConfirmContent.style.display = 'block';
            modalPromptContent.style.display = 'none';
            
            modalMessage.textContent = options.message || '';
            modalConfirmBtn.textContent = options.confirmText || '确认';
            modalConfirmBtn.style.color = options.isDestructive ? '#ff3b30' : '#2c2c2e';
        }

        customModalOverlay.style.display = 'flex';
        // force reflow
        void customModalOverlay.offsetWidth;
        customModalOverlay.classList.add('active');
        
        // Ensure sheet transform resets
        const sheet = customModalOverlay.querySelector('.bottom-sheet');
        if(sheet) sheet.style.transform = 'translateY(0)';

        if (options.type === 'prompt') {
            setTimeout(() => modalInput.focus(), 300);
        }
    }

    function closeCustomModal() {
        if (!customModalOverlay) return;
        // Animation handled by CSS transitions on .bottom-sheet inside overlay
        customModalOverlay.classList.remove('active');
        
        setTimeout(() => {
            customModalOverlay.style.display = 'none';
        }, 300);
        currentModalCallback = null;
    }

    // Bind Modal Events
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeCustomModal);
    
    if (modalConfirmBtn) {
        modalConfirmBtn.addEventListener('click', () => {
            if (currentModalCallback) currentModalCallback(true);
            closeCustomModal();
        });
    }

    if (modalPromptConfirmBtn) {
        modalPromptConfirmBtn.addEventListener('click', () => {
            if (currentModalCallback) currentModalCallback(modalInput.value);
            closeCustomModal();
        });
    }

    // Click overlay to close (optional, standard action sheet usually requires cancel button)
    if (customModalOverlay) {
        customModalOverlay.addEventListener('click', (e) => {
            if (e.target === customModalOverlay) closeCustomModal();
        });
    }

    // iMessage (LINE Style) View Initialization
    const imessageView = document.getElementById('imessage-view');
    const dockIcon = document.getElementById('dock-icon-imessage');
    
    if (dockIcon) {
        dockIcon.addEventListener('click', () => {
            if (syncUIs) syncUIs();
            openView(imessageView);
        });
    }

    // iMessage Header Left (Back) Action
    const imHeaderLeft = document.querySelector('.line-header-left');
    if (imHeaderLeft) {
        imHeaderLeft.addEventListener('click', () => {
            closeView(imessageView);
        });
    }

    // Global list of added friends
    let imFriends = [];
    let currentActiveFriend = null;

    // --- Load from LocalStorage ---
    try {
        const storedFriends = localStorage.getItem('ios_emulator_friends');
        if (storedFriends) {
            imFriends = JSON.parse(storedFriends);
            renderFriendsList();
        }
    } catch(e) {
        console.error('Failed to load friends from local storage', e);
    }
    
    // Apply saved CSS for all loaded friends
    setTimeout(() => applyAllSavedCss(), 100);
    
    // Export friends for other modules
    window.getImFriends = () => imFriends;
    window.addImFriend = addImFriend;

    function addImFriend(friendData) {
        const friend = {
            id: Date.now(),
            realName: friendData.realName || '',
            nickname: friendData.nickname || 'New Friend',
            signature: friendData.signature || 'No Signature',
            persona: friendData.persona || '',
            avatarUrl: friendData.avatarUrl || null,
            messages: [],
            chatBg: null,
            customCssEnabled: false,
            customCss: ''
        };
        imFriends.push(friend);
        saveFriends();
        renderFriendsList();
        showToast(`已添加好友: ${friend.nickname}`);
    }

    function saveFriends() {
        try {
            localStorage.setItem('ios_emulator_friends', JSON.stringify(imFriends));
        } catch(e) {
            console.error('Storage full or error', e);
            showToast('保存失败，可能存储空间已满');
        }
    }

    // iMessage Header Icons
    const imHeaderIcons = document.querySelectorAll('.line-header-right i');
    if (imHeaderIcons.length >= 3) {
        imHeaderIcons[0].addEventListener('click', () => showToast('Bookmark clicked')); // Bookmark
        
        // Add Friend logic (Open Modal)
        imHeaderIcons[1].addEventListener('click', () => {
            // Reset fields
            if(UI.inputs.friendRealName) UI.inputs.friendRealName.value = '';
            if(UI.inputs.friendNickname) UI.inputs.friendNickname.value = '';
            if(UI.inputs.friendSignature) UI.inputs.friendSignature.value = '';
            if(UI.inputs.friendPersona) UI.inputs.friendPersona.value = '';
            setFriendAvatar(null);
            openView(UI.overlays.addFriend);
        });
        
        imHeaderIcons[2].addEventListener('click', () => showToast('Settings clicked')); // Settings
    }

    // Add Friend Modal Logic
    const friendAvatarWrapper = document.getElementById('friend-avatar-wrapper');
    if(friendAvatarWrapper) {
        friendAvatarWrapper.addEventListener('click', () => {
            document.getElementById('friend-avatar-upload').click();
        });
    }

    const friendAvatarUpload = document.getElementById('friend-avatar-upload');
    if(friendAvatarUpload) {
        friendAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => setFriendAvatar(e.target.result);
                reader.readAsDataURL(file);
            }
        });
    }

    function setFriendAvatar(url) {
        if (!UI.inputs.friendAvatarImg || !UI.inputs.friendAvatarIcon) return;
        if (url) {
            UI.inputs.friendAvatarImg.src = url;
            UI.inputs.friendAvatarImg.style.display = 'block';
            UI.inputs.friendAvatarIcon.style.display = 'none';
        } else {
            UI.inputs.friendAvatarImg.style.display = 'none';
            UI.inputs.friendAvatarIcon.style.display = 'block';
            UI.inputs.friendAvatarImg.src = '';
        }
    }

    const confirmAddFriendBtn = document.getElementById('confirm-add-friend-btn');
    if(confirmAddFriendBtn) {
        confirmAddFriendBtn.addEventListener('click', () => {
            const friend = {
                id: Date.now(),
                realName: UI.inputs.friendRealName.value,
                nickname: UI.inputs.friendNickname.value || 'New Friend',
                signature: UI.inputs.friendSignature.value || 'No Signature',
                persona: UI.inputs.friendPersona.value,
                avatarUrl: UI.inputs.friendAvatarImg.style.display === 'block' ? UI.inputs.friendAvatarImg.src : null,
                messages: [], // Array to store messages for isolation
                chatBg: null, // Background image
                customCssEnabled: false,
                customCss: ''
            };
            
            imFriends.push(friend);
            saveFriends();
            renderFriendsList();
            closeView(UI.overlays.addFriend);
            showToast(`Added ${friend.nickname}`);
        });
    }

    function renderFriendsList() {
        const friendsContent = document.getElementById('friends-content');
        if (!friendsContent) return;
        friendsContent.innerHTML = '';
        
        imFriends.forEach(friend => {
            const item = document.createElement('div');
            item.className = 'line-list-item';
            
            const avatarHtml = friend.avatarUrl 
                ? `<img src="${friend.avatarUrl}" style="width:100%;height:100%;object-fit:cover;">` 
                : `<i class="fas fa-user"></i>`;
                
            item.innerHTML = `
                <div class="line-item-avatar">${avatarHtml}</div>
                <div class="line-item-text">${friend.nickname}</div>
            `;
            
            // Clicking a friend now opens a dedicated Chat Interface embedded in Chats Tab
            item.addEventListener('click', () => {
                openChatTab(friend);
            });

            friendsContent.appendChild(item);
        });
    }

    // iMessage Service Icons (Dummy Actions)
    const imServiceItems = document.querySelectorAll('.line-service-item');
    imServiceItems.forEach(item => {
        item.addEventListener('click', () => {
            const text = item.querySelector('span').textContent;
            showToast(`Opened ${text}`);
        });
    });

    // iMessage Collapsible Sections
    const groupsToggle = document.getElementById('groups-toggle');
    if (groupsToggle) {
        groupsToggle.addEventListener('click', () => {
            groupsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    const friendsToggle = document.getElementById('friends-toggle');
    if (friendsToggle) {
        friendsToggle.addEventListener('click', () => {
            friendsToggle.parentElement.classList.toggle('collapsed');
        });
    }

    // --- Bottom Nav Logic ---
    const navHomeBtn = document.getElementById('nav-home-btn');
    const navChatsBtn = document.getElementById('nav-chats-btn');
    const navCallsBtn = document.getElementById('nav-calls-btn');
    const lineNavIndicator = document.getElementById('line-nav-indicator');
    const imBottomNavContainer = document.querySelector('.line-bottom-nav-container');
    
    const imContent = document.querySelector('.line-content'); // Home content
    const chatsContent = document.getElementById('chats-content');
    const callsContent = document.getElementById('calls-content');

    // Helper: Update Sliding Indicator for iMessage
    function updateLineNavIndicator(activeItem) {
        if (!activeItem || !lineNavIndicator) return;
        
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        
        lineNavIndicator.style.width = `${itemRect.width}px`;
        lineNavIndicator.style.left = `${relativeLeft}px`;
    }

    // Initialize Line Indicator
    setTimeout(() => {
        if(navHomeBtn && navHomeBtn.classList.contains('active')) updateLineNavIndicator(navHomeBtn);
    }, 100);

    function hideAllTabs() {
        if(imContent) imContent.style.display = 'none';
        if(chatsContent) chatsContent.style.display = 'none';
        if(callsContent) callsContent.style.display = 'none';
        
        if(navHomeBtn) navHomeBtn.classList.remove('active');
        if(navChatsBtn) navChatsBtn.classList.remove('active');
        if(navCallsBtn) navCallsBtn.classList.remove('active');
    }

    if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => {
            hideAllTabs();
            if(imContent) imContent.style.display = 'block';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            navHomeBtn.classList.add('active');
            updateLineNavIndicator(navHomeBtn);
        });
    }

    if (navChatsBtn) {
        navChatsBtn.addEventListener('click', () => {
            hideAllTabs();
            if(chatsContent) {
                chatsContent.style.display = 'flex';
                chatsContent.style.flexDirection = 'column';
                updateChatsView();
            }
            navChatsBtn.classList.add('active');
            updateLineNavIndicator(navChatsBtn);
        });
    }

    function updateChatsView() {
        const emptyState = document.getElementById('chats-empty-state');
        const listContainer = document.getElementById('chats-list-container');
        const lineHeader = document.querySelector('.line-header');
        
        // Hide all chat interfaces
        Array.from(chatsContent.children).forEach(child => {
            if (child.classList.contains('active-chat-interface')) {
                child.style.display = 'none';
            }
        });

        if (currentActiveFriend) {
            // Show active chat
            if(emptyState) emptyState.style.display = 'none';
            if(listContainer) listContainer.style.display = 'none';
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'none';
            if(lineHeader) lineHeader.style.display = 'none'; // Hide main header to prevent glitch
            
            const pageId = `chat-interface-${currentActiveFriend.id}`;
            const page = document.getElementById(pageId);
            if (page) {
                page.style.display = 'flex';
                const container = page.querySelector('.ins-chat-messages');
                setTimeout(() => scrollToBottom(container), 50);
            }
        } else {
            // Show list or empty state
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            if(lineHeader) lineHeader.style.display = 'flex'; // Restore main header
            
            renderChatsList();
            const hasChats = imFriends.some(f => f.messages && f.messages.length > 0);
            if (hasChats) {
                if(emptyState) emptyState.style.display = 'none';
                if(listContainer) listContainer.style.display = 'block';
            } else {
                if(emptyState) emptyState.style.display = 'flex';
                if(listContainer) listContainer.style.display = 'none';
            }
        }
    }

    // Time Format Helper
    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        if (isToday) return `${hours}:${minutes}`;
        if (isYesterday) return `Yesterday`;
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function renderChatsList() {
        const chatsList = document.getElementById('chats-list');
        if (!chatsList) return;
        chatsList.innerHTML = '';
        
        const chattedFriends = imFriends.filter(f => f.messages && f.messages.length > 0);
        
        // Reverse to show latest first (assuming push order)
        // In a real app, you'd sort by timestamp
        chattedFriends.slice().reverse().forEach(friend => {
            const lastMsg = friend.messages[friend.messages.length - 1];
            let msgPreview = 'No messages';
            let timeStr = '';
            if (lastMsg) {
                msgPreview = lastMsg.content;
                timeStr = formatTime(lastMsg.timestamp);
            }

            const item = document.createElement('div');
            item.className = 'chat-item';
            
            const avatarHtml = friend.avatarUrl 
                ? `<img src="${friend.avatarUrl}">` 
                : `<i class="fas fa-user"></i>`;
                
            item.innerHTML = `
                <div class="chat-avatar">${avatarHtml}</div>
                <div class="chat-info">
                    <div class="chat-row-top">
                        <div class="chat-name">${friend.nickname}</div>
                        <div class="chat-time">${timeStr}</div>
                    </div>
                    <div class="chat-message">${msgPreview}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                openChatTab(friend);
            });
            
            chatsList.appendChild(item);
        });
    }

    if (navCallsBtn) {
        navCallsBtn.addEventListener('click', () => {
            hideAllTabs();
            if(callsContent) {
                callsContent.style.display = 'flex';
                callsContent.style.flexDirection = 'column';
            }
            if(imBottomNavContainer) imBottomNavContainer.style.display = 'flex';
            navCallsBtn.classList.add('active');
            updateLineNavIndicator(navCallsBtn);
        });
    }

    // --- Embedded Independent Chat Interface Logic ---
    function openChatTab(friend) {
        currentActiveFriend = friend;
        let pageId = `chat-interface-${friend.id}`;
        let page = document.getElementById(pageId);

        if (!page) {
            // Create new embedded chat interface using original Ins Style
            page = document.createElement('div');
            page.id = pageId;
            page.className = 'active-chat-interface';
            page.style.display = 'none';
            
            const avatarHtml = friend.avatarUrl 
                ? `<img src="${friend.avatarUrl}" style="display: block;">` 
                : `<i class="fas fa-user"></i>`;

            page.innerHTML = `
                <!-- Sticky Header Container for Fade Effect -->
                <div class="chat-sticky-container">
                    <!-- Chat Top Bar -->
                    <div class="chat-top-bar">
                        <div class="chat-back-btn"><i class="fas fa-chevron-left"></i></div>
                        <div class="chat-menu-btn"><i class="fas fa-bars"></i></div>
                    </div>

                    <!-- Ins Style Chat Header -->
                    <div class="ins-chat-header">
                        <div class="ins-chat-avatar">
                            ${avatarHtml}
                        </div>
                        <div class="ins-chat-name">${friend.nickname}</div>
                        <div class="ins-chat-sign">${friend.signature || 'No Signature'}</div>
                    </div>
                </div>

                <!-- Chat Messages Area -->
                <div class="ins-chat-messages"></div>

                <!-- Ins Style Bottom Input -->
                <div class="ins-chat-input-container">
                    <div class="ins-chat-input-wrapper">
                        <div class="ins-input-icon plus-btn"><i class="fas fa-plus"></i></div>
                        <input type="text" placeholder="发送消息..." class="ins-message-input chat-input">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div class="send-btn-icon send-btn"><i class="fas fa-paper-plane"></i></div>
                            <div class="send-btn-icon mic-btn"><i class="fas fa-microphone"></i></div>
                        </div>
                    </div>
                </div>
            `;

            if(chatsContent) chatsContent.appendChild(page);

            // Bind Events for this specific interface
            const backBtn = page.querySelector('.chat-back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    currentActiveFriend = null;
                    updateChatsView();
                });
            }
            
            // Edit Character on Header Click
            const headerEl = page.querySelector('.ins-chat-header');
            if (headerEl) {
                headerEl.onclick = () => {
                    const editSheet = document.getElementById('edit-char-persona-sheet');
                    if (!editSheet) {
                        console.error('Edit character sheet not found');
                        return;
                    }

                    // Inputs
                    const realNameInput = document.getElementById('char-realname-input');
                    const nicknameInput = document.getElementById('char-nickname-input');
                    const signatureInput = document.getElementById('char-signature-input');
                    const personaInput = document.getElementById('char-persona-input');
                    const avatarPreview = document.getElementById('char-edit-avatar-img');
                    const avatarIcon = document.getElementById('char-edit-avatar-preview');
                    let avatarI = null;
                    if(avatarIcon) avatarI = avatarIcon.querySelector('i');
                    
                    // Temp avatar state
                    let tempAvatarUrl = friend.avatarUrl;

                    // Load current data
                    if(realNameInput) realNameInput.value = friend.realName || '';
                    if(nicknameInput) nicknameInput.value = friend.nickname || '';
                    if(signatureInput) signatureInput.value = friend.signature || '';
                    if(personaInput) personaInput.value = friend.persona || '';
                    
                    // Set Avatar
                    if (friend.avatarUrl) {
                        if(avatarPreview) { avatarPreview.src = friend.avatarUrl; avatarPreview.style.display = 'block'; }
                        if(avatarI) avatarI.style.display = 'none';
                    } else {
                        if(avatarPreview) { avatarPreview.style.display = 'none'; avatarPreview.src = ''; }
                        if(avatarI) avatarI.style.display = 'block';
                    }

                    // Avatar Upload Handler (Unique to this session)
                    const avatarWrapper = document.getElementById('char-edit-avatar-wrapper');
                    const avatarUpload = document.getElementById('char-edit-avatar-upload');
                    
                    if (avatarWrapper && avatarUpload) {
                        // Clone to remove old listeners
                        const newAvatarWrapper = avatarWrapper.cloneNode(true);
                        avatarWrapper.parentNode.replaceChild(newAvatarWrapper, avatarWrapper);
                        
                        const newAvatarUpload = avatarUpload.cloneNode(true);
                        avatarUpload.parentNode.replaceChild(newAvatarUpload, avatarUpload);

                        newAvatarWrapper.addEventListener('click', () => {
                            newAvatarUpload.click();
                        });

                        newAvatarUpload.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    tempAvatarUrl = ev.target.result;
                                    const img = document.getElementById('char-edit-avatar-img');
                                    const iconPreview = document.getElementById('char-edit-avatar-preview');
                                    let iconI = null;
                                    if(iconPreview) iconI = iconPreview.querySelector('i');
                                    if(img) { img.src = tempAvatarUrl; img.style.display = 'block'; }
                                    if(iconI) iconI.style.display = 'none';
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                    }

                    // Confirm Action
                    const confirmBtn = document.getElementById('confirm-char-persona-btn');
                    if (confirmBtn) {
                        // Clone to ensure clean event listener state
                        const newConfirmBtn = confirmBtn.cloneNode(true);
                        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                        
                        newConfirmBtn.addEventListener('click', () => {
                            // Save Data
                            friend.realName = realNameInput ? realNameInput.value : '';
                            friend.nickname = nicknameInput ? (nicknameInput.value || 'New Friend') : 'New Friend';
                            friend.signature = signatureInput ? signatureInput.value : '';
                            friend.persona = personaInput ? personaInput.value : '';
                            friend.avatarUrl = tempAvatarUrl;
                            
                            saveFriends();
                            
                            // Update UI immediately for THIS SPECIFIC page
                            const nameEl = page.querySelector('.ins-chat-name');
                            const signEl = page.querySelector('.ins-chat-sign');
                            const avatarContainer = page.querySelector('.ins-chat-avatar');
                            
                            if(nameEl) nameEl.textContent = friend.nickname;
                            if(signEl) signEl.textContent = friend.signature || 'Signature/Bio';
                            
                            if (avatarContainer) {
                                if (friend.avatarUrl) {
                                    avatarContainer.innerHTML = `<img src="${friend.avatarUrl}" style="display: block; width: 100%; height: 100%; object-fit: cover;">`;
                                } else {
                                    avatarContainer.innerHTML = `<i class="fas fa-user"></i>`;
                                }
                            }
                            
                            renderFriendsList(); // Update side list
                            renderChatsList(); // Update chats list preview
                            
                            showToast('角色修改成功');
                            closeView(editSheet);
                        });
                    }

                    openView(editSheet);
                };
            }

            const menuBtn = page.querySelector('.chat-menu-btn');
            if (menuBtn) {
                menuBtn.addEventListener('click', () => {
                    const chatSettingsSheet = document.getElementById('chat-settings-sheet');
                    if (chatSettingsSheet) {
                        openView(chatSettingsSheet);
                        initChatSettingsForFriend(friend);
                    }
                });
            }

            const input = page.querySelector('.chat-input');
            const sendBtn = page.querySelector('.send-btn');
            const micBtn = page.querySelector('.mic-btn');
            const msgContainer = page.querySelector('.ins-chat-messages');

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    handleSend(friend, input, msgContainer);
                }
            });

            sendBtn.addEventListener('click', () => {
                handleSend(friend, input, msgContainer);
            });

            micBtn.addEventListener('click', () => {
                handleAiReply(friend, msgContainer, micBtn);
            });

            // Load History with Time Stamps
            let lastTime = 0;
            if (friend.messages && friend.messages.length > 0) {
                friend.messages.forEach(msg => {
                    const msgTime = msg.timestamp || 0;
                    if (msgTime - lastTime > 300000) { // 5 minutes
                        renderTimestamp(msgTime, msgContainer);
                        lastTime = msgTime;
                    }
                    
                    if (msg.role === 'user') {
                        renderUserBubble(msg.content, msgContainer, msgTime);
                    } else if (msg.role === 'assistant') {
                        renderAiBubble(msg.content, friend, msgContainer, msgTime);
                    }
                });
            }
        }

        // Apply background if set
        applyFriendBg(friend);
        
        // Init timestamp setting check
        initTimestampSetting(friend);
        
        // Apply class based on setting
        if(page) {
            if(friend.showTimestamp) {
                page.classList.add('show-timestamps');
            } else {
                page.classList.remove('show-timestamps');
            }
        }

        // Navigation logic: trigger Chats Tab click to handle view switching
        if (navChatsBtn) {
            // If already on chats tab, manual update
            if (navChatsBtn.classList.contains('active')) {
                updateChatsView();
            } else {
                navChatsBtn.click();
            }
        }
    }

    function scrollToBottom(container) {
        if(container) container.scrollTop = container.scrollHeight;
    }

    function renderTimestamp(timestamp, container) {
        if (!timestamp) return;
        const div = document.createElement('div');
        div.className = 'chat-timestamp';
        
        const date = new Date(timestamp);
        let timeStr = formatTime(timestamp);
        // If full date needed, logic can be added here
        
        div.innerHTML = `<span>${timeStr}</span>`;
        container.appendChild(div);
    }

    // --- Message Rendering & Handling (Per Interface) ---

    function renderUserBubble(text, container, timestamp = Date.now()) {
        // Consecutive Check
        const lastRow = container.lastElementChild;
        let hasPrev = false;
        if (lastRow && lastRow.classList.contains('user-row')) {
            hasPrev = true;
            lastRow.classList.add('has-next');
        }

        const row = document.createElement('div');
        row.className = `chat-row user-row ${hasPrev ? 'has-prev' : ''}`;
        
        let contentHtml = text;
        
        // Always render timestamp structure, CSS controls visibility
        const date = new Date(timestamp);
        const timeStr = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span><i class="fas fa-check-double bubble-read-icon"></i></span>`;

        row.innerHTML = `<div class="chat-bubble user-bubble">${contentHtml}</div>`;
        container.appendChild(row);
        scrollToBottom(container);
    }

    function renderAiBubble(text, friend, container, timestamp = Date.now()) {
        const lastRow = container.lastElementChild;
        let hasPrev = false;
        if (lastRow && lastRow.classList.contains('ai-row') && !lastRow.classList.contains('typing-row')) {
            hasPrev = true;
            lastRow.classList.add('has-next');
        }

        const row = document.createElement('div');
        row.className = `chat-row ai-row ${hasPrev ? 'has-prev' : ''}`;
        
        const avatarHtml = (friend && friend.avatarUrl) 
            ? `<img src="${friend.avatarUrl}">`
            : `<i class="fas fa-user"></i>`;
            
        let contentHtml = text;
        // Always render timestamp structure, CSS controls visibility
        const date = new Date(timestamp);
        const timeStr = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        contentHtml += `<span class="bubble-meta"><span class="bubble-time">${timeStr}</span></span>`;

        row.innerHTML = `
            <div class="chat-avatar-small">${avatarHtml}</div>
            <div class="chat-bubble ai-bubble">${contentHtml}</div>
        `;
        container.appendChild(row);
        scrollToBottom(container);
    }

    function handleSend(friend, inputEl, container) {
        const text = inputEl.value.trim();
        if (!text) return;

        // Time Check
        const now = Date.now();
        const lastMsg = friend.messages && friend.messages.length > 0 
            ? friend.messages[friend.messages.length - 1] 
            : null;
        
        if (!lastMsg || (now - (lastMsg.timestamp || 0) > 300000)) {
            renderTimestamp(now, container);
        }

        renderUserBubble(text, container, now);
        inputEl.value = '';

        // Save Data
        if (!friend.messages) friend.messages = [];
        friend.messages.push({ role: 'user', content: text, timestamp: now });
        saveFriends();
    }

    async function handleAiReply(friend, container, btnEl) {
        if (!apiConfig.endpoint || !apiConfig.apiKey) {
            showToast('请先在设置中配置 API');
            return;
        }

        // Show Typing
        const typingRow = document.createElement('div');
        typingRow.className = 'chat-row ai-row typing-row';
        const avatarHtml = (friend && friend.avatarUrl) ? `<img src="${friend.avatarUrl}">` : `<i class="fas fa-user"></i>`;
        typingRow.innerHTML = `
            <div class="chat-avatar-small">${avatarHtml}</div>
            <div class="typing-indicator">
                <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
            </div>
        `;
        container.appendChild(typingRow);
        scrollToBottom(container);
        
        if(btnEl) btnEl.style.opacity = '0.5';

        // Prepare Context
        const systemPrompt = `You are playing the role of ${friend.realName || friend.nickname}. 
Your persona is: ${friend.persona || 'No specific persona'}. 
You are talking to ${userState.name}, whose persona is: ${userState.persona || 'A normal user'}.
Reply naturally as your character in a chat app. Do not include your own name at the beginning.`;

        const messages = [{ role: 'system', content: systemPrompt }];
        if (friend.messages) {
            const recent = friend.messages.slice(-10);
            recent.forEach(m => messages.push({ role: m.role, content: m.content }));
        }
        if (messages.length === 1) messages.push({ role: 'user', content: 'Hello' });

        try {
            let endpoint = apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` },
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: parseFloat(apiConfig.temperature) || 0.7
                })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const reply = data.choices[0].message.content;

            if (typingRow) typingRow.remove();

            // Time Check for AI
            const now = Date.now();
            const lastMsg = friend.messages[friend.messages.length - 1]; // User's msg
            if (!lastMsg || (now - (lastMsg.timestamp || 0) > 300000)) {
                renderTimestamp(now, container);
            }

            renderAiBubble(reply, friend, container, now);

            // Save Data
            if (!friend.messages) friend.messages = [];
            friend.messages.push({ role: 'assistant', content: reply, timestamp: now });
            saveFriends();

        } catch (error) {
            if (typingRow) typingRow.remove();
            showToast('API 请求失败');
            console.error(error);
        } finally {
            if(btnEl) btnEl.style.opacity = '1';
        }
    }

    // --- Chat Settings Logic ---
    const chatSettingsSheet = document.getElementById('chat-settings-sheet');
    let currentSettingsFriend = null;

    // Bind World Book Elements
    const bindWorldBookSheet = document.getElementById('bind-world-book-sheet');
    const bindWorldBookList = document.getElementById('bind-world-book-list');
    const confirmBindWorldBookBtn = document.getElementById('confirm-bind-world-book-btn');
    const worldBookBtn = document.getElementById('world-book-btn');
    
    let tempSelectedBookIds = [];
    
    const editCharPersonaSheet = document.getElementById('edit-char-persona-sheet');
    if (editCharPersonaSheet) {
        editCharPersonaSheet.addEventListener('click', (e) => {
            if (e.target === editCharPersonaSheet) {
                closeView(editCharPersonaSheet);
            }
        });
    }

    // Support clicking overlay to close
    if (chatSettingsSheet) {
        chatSettingsSheet.addEventListener('click', (e) => {
            if (e.target === chatSettingsSheet) {
                closeView(chatSettingsSheet);
            }
        });
    }

    // Support clicking overlay to close for bind world book
    if (bindWorldBookSheet) {
        bindWorldBookSheet.addEventListener('click', (e) => {
            if (e.target === bindWorldBookSheet) {
                closeView(bindWorldBookSheet);
            }
        });
    }

    if (worldBookBtn && bindWorldBookSheet) {
        worldBookBtn.addEventListener('click', () => {
            if (!currentSettingsFriend) return;
            // Initialize temp state with currently bound books
            tempSelectedBookIds = [...(currentSettingsFriend.boundBooks || [])];
            renderBindWorldBookList();
            openView(bindWorldBookSheet);
        });
    }

    if (confirmBindWorldBookBtn) {
        confirmBindWorldBookBtn.addEventListener('click', () => {
            if (currentSettingsFriend) {
                currentSettingsFriend.boundBooks = [...tempSelectedBookIds];
                saveFriends();
                // Sync Local Tab in World Book
                if (window.renderWorldBooks) window.renderWorldBooks();
                showToast('世界书绑定已更新');
            }
            closeView(bindWorldBookSheet);
        });
    }

    function renderBindWorldBookList() {
        if (!bindWorldBookList) return;
        bindWorldBookList.innerHTML = '';
        
        const allBooks = window.getWorldBooks ? window.getWorldBooks() : [];
        
        if (allBooks.length === 0) {
            bindWorldBookList.innerHTML = '<div style="text-align: center; color: #8e8e93; padding: 20px;">暂无世界书，请先在主界面创建</div>';
            return;
        }

        allBooks.forEach(book => {
            const isSelected = tempSelectedBookIds.includes(book.id);
            const tokens = window.calculateTokens ? window.calculateTokens(book.entries) : 0;
            
            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.padding = '12px 16px';
            item.style.height = 'auto';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '16px';
            item.style.border = isSelected ? '2px solid var(--blue-color)' : '2px solid transparent';
            item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            // Remove the pseudo-element line by setting relative and overflow
            item.style.position = 'relative';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; background-color: #1c1c1e; border-radius: 10px; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 16px;">
                            <i class="fas fa-book"></i>
                        </div>
                        <div>
                            <div style="font-size: 16px; font-weight: 500; color: #000;">${book.name}</div>
                            <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">分组: ${book.group}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 13px; color: #8e8e93;">+${tokens} Tokens</span>
                        <div style="width: 22px; height: 22px; border-radius: 50%; border: 1px solid ${isSelected ? 'var(--blue-color)' : '#c7c7cc'}; background-color: ${isSelected ? 'var(--blue-color)' : 'transparent'}; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 12px;">
                            ${isSelected ? '<i class="fas fa-check"></i>' : ''}
                        </div>
                    </div>
                </div>
            `;
            
            // To override .account-card:not(:last-child)::after
            const styleFix = document.createElement('style');
            styleFix.innerHTML = `#bind-world-book-list .account-card::after { display: none !important; }`;
            item.appendChild(styleFix);

            item.addEventListener('click', () => {
                if (tempSelectedBookIds.includes(book.id)) {
                    tempSelectedBookIds = tempSelectedBookIds.filter(id => id !== book.id);
                } else {
                    tempSelectedBookIds.push(book.id);
                }
                renderBindWorldBookList();
            });
            
            bindWorldBookList.appendChild(item);
        });
    }

    const bubbleStyleToggle = document.getElementById('bubble-style-toggle');
    const bubbleCssContainer = document.getElementById('bubble-css-container');
    const bubbleStyleHeader = document.getElementById('bubble-style-header');
    const bubbleCssInput = document.getElementById('bubble-css-input');
    const applyCssBtn = document.getElementById('apply-css-btn');
    const deleteFriendBtn = document.getElementById('delete-friend-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const resetCssBtn = document.getElementById('reset-css-btn');
    
    // Chat Background Elements
    const chatBgUpload = document.getElementById('chat-bg-upload');
    const chatBgUploadIcon = document.getElementById('chat-bg-upload-icon');
    const chatBgSaveIcon = document.getElementById('chat-bg-save-icon');
    const chatBgResetIcon = document.getElementById('chat-bg-reset-icon');

    // Chat Background Logic
    if (chatBgUploadIcon && chatBgUpload) {
        chatBgUploadIcon.addEventListener('click', () => {
            chatBgUpload.click();
        });

        chatBgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && currentSettingsFriend) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const bgUrl = ev.target.result;
                    currentSettingsFriend.chatBg = bgUrl;
                    saveFriends();
                    applyFriendBg(currentSettingsFriend);
                    showToast('已更换聊天背景');
                };
                reader.readAsDataURL(file);
            }
            e.target.value = ''; // Reset
        });
    }

    if (chatBgResetIcon) {
        chatBgResetIcon.addEventListener('click', () => {
            if (currentSettingsFriend) {
                currentSettingsFriend.chatBg = null;
                saveFriends();
                applyFriendBg(currentSettingsFriend);
                showToast('已重置聊天背景');
            }
        });
    }

    function applyFriendBg(friend) {
        if (!friend) return;
        const page = document.getElementById(`chat-interface-${friend.id}`);
        if (page) {
            if (friend.chatBg) {
                page.style.backgroundImage = `url(${friend.chatBg})`;
                page.style.backgroundSize = 'cover';
                page.style.backgroundPosition = 'center';
            } else {
                page.style.backgroundImage = 'none';
                page.style.backgroundColor = '#ffffff'; // default
            }
        }
    }

    if (bubbleStyleToggle) {
        bubbleStyleToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                bubbleCssContainer.style.display = 'block';
                if(bubbleStyleHeader) {
                    bubbleStyleHeader.style.borderBottomLeftRadius = '0';
                    bubbleStyleHeader.style.borderBottomRightRadius = '0';
                }
            } else {
                bubbleCssContainer.style.display = 'none';
                if(bubbleStyleHeader) {
                    bubbleStyleHeader.style.borderBottomLeftRadius = '20px';
                    bubbleStyleHeader.style.borderBottomRightRadius = '20px';
                }
            }
            // 保存状态到当前 friend
            if (currentSettingsFriend) {
                currentSettingsFriend.customCssEnabled = e.target.checked;
                saveFriends();
                applyFriendCss(currentSettingsFriend);
            }
        });
    }

    if (applyCssBtn) {
        applyCssBtn.addEventListener('click', () => {
            if (currentSettingsFriend) {
                currentSettingsFriend.customCss = bubbleCssInput.value;
                saveFriends();
                applyFriendCss(currentSettingsFriend);
                showToast('已应用自定义样式');
            }
        });
    }

    if (resetCssBtn) {
        resetCssBtn.addEventListener('click', () => {
            if (currentSettingsFriend) {
                currentSettingsFriend.customCss = '';
                bubbleCssInput.value = '';
                saveFriends();
                applyFriendCss(currentSettingsFriend);
                showToast('已重置');
            }
        });
    }

    // Clear History Logic with Custom Modal
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (currentSettingsFriend) {
                showCustomModal({
                    title: '清空聊天记录',
                    message: '确定清空所有聊天记录吗？此操作不可恢复。',
                    isDestructive: true,
                    confirmText: '清空',
                    onConfirm: () => {
                        currentSettingsFriend.messages = [];
                        saveFriends();
                        
                        // Clear the DOM messages
                        const page = document.getElementById(`chat-interface-${currentSettingsFriend.id}`);
                        if (page) {
                            const msgContainer = page.querySelector('.ins-chat-messages');
                            if (msgContainer) msgContainer.innerHTML = '';
                        }
                        
                        showToast('已清空聊天记录');
                        closeView(chatSettingsSheet);
                        renderChatsList();
                    }
                });
            }
        });
    }

    if (deleteFriendBtn) {
        deleteFriendBtn.addEventListener('click', () => {
            if (currentSettingsFriend) {
                showCustomModal({
                    title: '删除好友',
                    message: `确定删除好友 ${currentSettingsFriend.nickname} 吗？此操作不可恢复。`,
                    isDestructive: true,
                    confirmText: '删除',
                    onConfirm: () => {
                        // Remove from array
                        imFriends = imFriends.filter(f => f.id !== currentSettingsFriend.id);
                        saveFriends();
                        renderFriendsList();
                        // Close settings and chat
                        closeView(chatSettingsSheet);
                        currentActiveFriend = null;
                        updateChatsView();
                        
                        // Remove dom node
                        const page = document.getElementById(`chat-interface-${currentSettingsFriend.id}`);
                        if (page) page.remove();
                        
                        showToast('已删除好友');
                    }
                });
            }
        });
    }

    function initChatSettingsForFriend(friend) {
        currentSettingsFriend = friend;
        if (bubbleStyleToggle) {
            bubbleStyleToggle.checked = !!friend.customCssEnabled;
            // 触发 change 视觉效果
            bubbleStyleToggle.dispatchEvent(new Event('change'));
        }
        if (bubbleCssInput) {
            bubbleCssInput.value = friend.customCss || '';
        }
        // Sync Timestamp Toggle
        const tsToggle = document.getElementById('timestamp-toggle');
        if (tsToggle) {
            tsToggle.checked = !!friend.showTimestamp;
        }
    }
    
    // Listen for timestamp toggle changes
    const tsToggle = document.getElementById('timestamp-toggle');
    if (tsToggle) {
        tsToggle.addEventListener('change', (e) => {
            if (currentSettingsFriend) {
                currentSettingsFriend.showTimestamp = e.target.checked;
                saveFriends();
                
                // Toggle Class on Chat Page
                const page = document.getElementById(`chat-interface-${currentSettingsFriend.id}`);
                if (page) {
                    if (currentSettingsFriend.showTimestamp) {
                        page.classList.add('show-timestamps');
                    } else {
                        page.classList.remove('show-timestamps');
                    }
                }
            }
        });
    }
    
    function initTimestampSetting(friend) {
        // Just ensures global var is set if needed, though usually set on open settings
        // If chat is opened, we might want to know config for rendering new messages
        currentSettingsFriend = friend;
    }

    function applyFriendCss(friend) {
        // 创建或更新对应的 style 标签
        let styleTag = document.getElementById(`custom-style-${friend.id}`);
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = `custom-style-${friend.id}`;
            document.head.appendChild(styleTag);
        }

        if (friend.customCssEnabled && friend.customCss) {
            // 为防止影响全局，可以在前面加上特定 chat interface 的前缀
            // 例如 #chat-interface-xxx .user-bubble
            const prefix = `#chat-interface-${friend.id} `;
            // 简单的正则替换，给每个规则加上前缀
            let css = friend.customCss.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/ig, prefix + '$1$2');
            styleTag.innerHTML = css;
        } else {
            styleTag.innerHTML = '';
        }
    }
    
    // 初始化应用所有现存的 CSS
    function applyAllSavedCss() {
        imFriends.forEach(f => applyFriendCss(f));
    }

    // CSS Presets Logic
    const saveCssPresetBtn = document.getElementById('save-css-preset-btn');
    const loadCssPresetBtn = document.getElementById('load-css-preset-btn');
    const cssPresetListSheet = document.getElementById('css-preset-list-sheet');
    const cssPresetList = document.getElementById('css-preset-list');

    // Support clicking overlay to close preset list
    if (cssPresetListSheet) {
        cssPresetListSheet.addEventListener('click', (e) => {
            if (e.target === cssPresetListSheet) {
                closeView(cssPresetListSheet);
            }
        });
    }

    let cssPresets = JSON.parse(localStorage.getItem('ios_emulator_css_presets') || '[]');

    if (saveCssPresetBtn) {
        saveCssPresetBtn.addEventListener('click', () => {
            if (!currentSettingsFriend) return;
            
            showCustomModal({
                type: 'prompt',
                title: '存为预设',
                placeholder: '输入预设名称',
                confirmText: '保存',
                onConfirm: (name) => {
                    if (name && name.trim()) {
                        cssPresets.push({ name: name.trim(), css: bubbleCssInput.value, id: Date.now() });
                        localStorage.setItem('ios_emulator_css_presets', JSON.stringify(cssPresets));
                        showToast('预设已保存');
                    }
                }
            });
        });
    }

    if (loadCssPresetBtn) {
        loadCssPresetBtn.addEventListener('click', () => {
            renderCssPresetList();
            openView(cssPresetListSheet);
        });
    }

    function renderCssPresetList() {
        if (!cssPresetList) return;
        cssPresetList.innerHTML = '';
        if (cssPresets.length === 0) {
            cssPresetList.innerHTML = '<div style="padding: 20px; text-align: center; color: #8e8e93;">暂无预设</div>';
            return;
        }

        cssPresets.forEach(preset => {
            const item = document.createElement('div');
            item.className = 'account-card';
            item.innerHTML = `
                <div class="account-content" style="cursor: pointer;">
                    <div class="account-info">
                        <div class="account-name">${preset.name}</div>
                    </div>
                </div>
                <div class="delete-icon"><i class="fas fa-times"></i></div>
            `;

            // Apply preset
            item.querySelector('.account-content').addEventListener('click', () => {
                if (currentSettingsFriend) {
                    bubbleCssInput.value = preset.css;
                    applyCssBtn.click(); // Trigger apply
                    closeView(cssPresetListSheet);
                }
            });

            // Delete preset
            item.querySelector('.delete-icon').addEventListener('click', (e) => {
                e.stopPropagation();
                cssPresets = cssPresets.filter(p => p.id !== preset.id);
                localStorage.setItem('ios_emulator_css_presets', JSON.stringify(cssPresets));
                renderCssPresetList();
            });

            cssPresetList.appendChild(item);
        });
    }
});
