document.addEventListener('DOMContentLoaded', () => {

    // 1. YouTube Mock Data & Discovery Content
    let mockVideos = []; // Global video list
    let currentChatHistory = []; // Store chat history for summary
    
    // Initial empty mock subscription list
    let mockSubscriptions = []; 
    let hasSubscriptions = false;

    // Channel Data State
    let ytUserState = null; // Internal state for YouTube app
    let channelState = {
        bannerUrl: null,
        url: '',
        boundWorldBookIds: [],
        systemPrompt: '',
        summaryPrompt: '',
        groupChatPrompt: '',
        vodPrompt: '',
        postPrompt: '',
        liveSummaries: [], // Store generated live summaries
        groupChatHistory: [], // Store group chat history
        cachedTrendingLive: null,
        cachedTrendingSub: null
    };

    // --- Helper Functions ---
    function parseSubs(str) {
        if (!str) return 0;
        let s = String(str).replace(/,/g, '').trim();
        let multi = 1;
        if (s.includes('亿')) { multi = 100000000; s = s.replace('亿', ''); }
        else if (s.includes('万')) { multi = 10000; s = s.replace('万', ''); }
        else if (s.toUpperCase().includes('K')) { multi = 1000; s = s.toUpperCase().replace('K', ''); }
        else if (s.toUpperCase().includes('M')) { multi = 1000000; s = s.toUpperCase().replace('M', ''); }
        let num = parseFloat(s);
        if (isNaN(num)) return 0;
        return Math.floor(num * multi);
    }

    function formatSubs(num) {
        if (num >= 100000000) {
            return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
        } else if (num >= 10000) {
            return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万';
        } else {
            return num.toString();
        }
    }

    // --- Data Persistence ---
    function loadYoutubeData() {
        try {
            const savedState = localStorage.getItem('yt_channel_state');
            if (savedState) {
                const parsed = JSON.parse(savedState);
                channelState = { ...channelState, ...parsed };
            }
            const savedSubs = localStorage.getItem('yt_subscriptions');
            if (savedSubs) {
                mockSubscriptions = JSON.parse(savedSubs);
                hasSubscriptions = mockSubscriptions.length > 0;
                // Re-populate mockVideos based on loaded subs
                mockVideos = [];
                mockSubscriptions.forEach(sub => {
                    if (sub.generatedContent && sub.generatedContent.currentLive) {
                        mockVideos.push({
                            title: sub.generatedContent.currentLive.title,
                            views: sub.generatedContent.currentLive.views,
                            time: 'LIVE',
                            thumbnail: sub.generatedContent.currentLive.thumbnail || 'https://picsum.photos/320/180',
                            isLive: true,
                            comments: sub.generatedContent.currentLive.comments || [],
                            initialBubbles: sub.generatedContent.currentLive.initialBubbles || [],
                            guest: sub.generatedContent.currentLive.guest || null,
                            channelData: sub
                        });
                    }
                });
            }
            const savedUser = localStorage.getItem('yt_user_state');
            if (savedUser) {
                ytUserState = JSON.parse(savedUser);
            }
        } catch (e) {
            console.error("Error loading YouTube data", e);
        }
    }

    function saveYoutubeData() {
        try {
            localStorage.setItem('yt_channel_state', JSON.stringify(channelState));
            localStorage.setItem('yt_subscriptions', JSON.stringify(mockSubscriptions));
            if (ytUserState) {
                localStorage.setItem('yt_user_state', JSON.stringify(ytUserState));
            }
        } catch (e) {
            console.error("Error saving YouTube data", e);
        }
    }

    // Load data initially
    loadYoutubeData();

    // 2. DOM Elements
    const ytView = document.getElementById('youtube-view');
    const subChannelView = document.getElementById('sub-channel-view');
    const dockIconYt = document.getElementById('dock-icon-youtube');
    const backBtn = document.getElementById('yt-back-btn');
    
    // Bottom Nav
    const navItems = document.querySelectorAll('.yt-nav-item');
    const navIndicator = document.getElementById('yt-nav-indicator');
    const tabContents = document.querySelectorAll('.yt-tab-content');

    // Home Tab Elements
    const subsList = document.getElementById('yt-subs-list');
    const liveSection = document.getElementById('yt-live-section');
    const emptyState = document.getElementById('yt-empty-state');
    const filterBubbles = document.querySelectorAll('.yt-filter-bubble');

    // Profile Tab Elements
    const profileName = document.getElementById('yt-profile-name');
    const profileHandle = document.getElementById('yt-profile-handle');
    const profileAvatarImg = document.getElementById('yt-profile-avatar-img');
    const profileAvatarIcon = document.querySelector('.yt-profile-avatar i');
    const profileHeaderBg = document.querySelector('.yt-profile-header-bg');
    const profileSubs = document.getElementById('yt-profile-subs');
    const profileVideos = document.getElementById('yt-profile-videos');
    const profileTabIndicator = document.getElementById('profile-tab-indicator');
    
    // Edit Channel Elements
    const editChannelBtn = document.getElementById('yt-edit-channel-btn');
    const editChannelSheet = document.getElementById('yt-edit-channel-sheet');
    const confirmEditBtn = document.getElementById('confirm-yt-edit-btn');

    // Edit Inputs
    const editNameInput = document.getElementById('yt-edit-name-input');
    const editHandleInput = document.getElementById('yt-edit-handle-input');
    const editUrlInput = document.getElementById('yt-edit-url-input');
    const editSubsInput = document.getElementById('yt-edit-subs-input');
    const editVideosInput = document.getElementById('yt-edit-videos-input');
    const editPersonaInput = document.getElementById('yt-edit-persona-input');
    
    // Edit Uploads
    const editBannerBtn = document.getElementById('yt-edit-banner-btn');
    const bannerUpload = document.getElementById('yt-banner-upload');
    const editBannerImg = document.getElementById('yt-edit-banner-img');
    
    const editAvatarWrapper = document.getElementById('yt-edit-avatar-wrapper');
    const avatarUpload = document.getElementById('yt-avatar-upload');
    const editAvatarImg = document.getElementById('yt-edit-avatar-img');
    const editAvatarIcon = document.querySelector('#yt-edit-avatar-preview i');

    // 3. App Launch & Close Logic
    if (dockIconYt && ytView) {
        dockIconYt.addEventListener('click', () => {
            if (!ytUserState && window.userState) {
                ytUserState = { ...window.userState }; // Shallow copy
            }
            if (!ytUserState) ytUserState = {}; // Fallback
            syncYtProfile();
            ytView.classList.add('active');
            renderSubscriptions();
            renderVideos();
        });
    }

    if (backBtn && ytView) {
        backBtn.addEventListener('click', () => {
            ytView.classList.remove('active');
        });
    }

    const homeBar = document.getElementById('home-bar');
    if (homeBar && ytView) {
        homeBar.addEventListener('click', () => {
            ytView.classList.remove('active');
        });
    }

    // 4. Bottom Nav Interaction
    
    // --- Messages Tab Logic ---
    const msgFilterDm = document.getElementById('msg-filter-dm');
    const msgFilterCommunity = document.getElementById('msg-filter-community');
    const msgFilterBusiness = document.getElementById('msg-filter-business');
    const msgListContainer = document.getElementById('yt-messages-list');
    const msgRefreshBtn = document.getElementById('yt-messages-refresh-btn');
    let currentMsgFilter = 'dm';

    if (msgRefreshBtn) {
        msgRefreshBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先配置 API');
                renderMessagesList();
                return;
            }
            
            if (currentMsgFilter === 'community') {
                if(window.showToast) window.showToast('社群不支持魔法棒生成');
                return;
            }

            msgRefreshBtn.style.opacity = '0.5';
            msgRefreshBtn.style.pointerEvents = 'none';
            if(window.showToast) window.showToast('正在生成新消息...');

            let wbContext = '';
            if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
                const wbs = window.getWorldBooks();
                channelState.boundWorldBookIds.forEach(id => {
                    const boundWb = wbs.find(w => w.id === id);
                    if (boundWb && boundWb.entries) {
                        wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                    }
                });
            }

            const userPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? (window.userState.persona || '普通用户') : '普通用户');
            
            const filterTypeAtRequest = currentMsgFilter;
            let prompt = '';
            if (filterTypeAtRequest === 'business') {
                prompt = `仔细阅读我的用户人设，根据我的用户人设生成3-5个**为你量身定制**的商务合作/赞助/联动邀请。
要求发件人是不同的品牌方、赞助商或希望联动的博主。合作内容必须与我的人设息息相关！
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
返回严格的JSON格式：
{
  "users": [
    {
      "name": "发件人名字(必须纯品牌名或频道名，绝对禁止在名字中添加'PR'、'经理'、'负责人'、'官方'等任何后缀！)",
      "avatarDesc": "英文单词描述头像(如: business logo)",
      "messages": [
        { "type": "text", "content": "你好！我们是某某品牌..." },
        { "type": "text", "content": "看了你的内容非常感兴趣..." },
        { "type": "offer", "offerData": { 
            "title": "游戏试玩推广", 
            "offerType": "填入枚举值: video(定制视频) 或 live(工商直播) 或 post(图文宣发) 或 collab(博主联动)",
            "requirement": "详细说明植入要求或直播要求，必须明确！", 
            "price": "必须写出具体金额，如：￥5000",
            "penalty": "违约金具体金额，如：￥2000"
          } 
        }
      ]
    }
  ]
}
注意：每个发件人的 messages 数组中，除了前面的文字寒暄，最后一条必须是 type 为 "offer" 的商单卡片。只能返回纯JSON。`;
            } else if (filterTypeAtRequest === 'dm') {
                prompt = `仔细阅读我的用户人设，生成3-5个不同的陌生人、同行或粉丝给你发私信的数据。
私信内容必须**强烈受我的人设影响**！他们可能是被你的人设吸引，也可能是针对你人设的某些特征来找你搭话。
我的用户人设："${userPersona}"。
世界观背景：${wbContext}
返回严格的JSON格式：
{
  "users": [
    {
      "name": "陌生人/同行/粉丝名字",
      "avatarDesc": "英文单词描述头像",
      "messages": [
        { "type": "text", "content": "第一条消息内容" },
        { "type": "text", "content": "第二条消息内容" }
      ]
    }
  ]
}
注意：只能返回纯JSON。`;
            }

            try {
                let endpoint = window.apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.9,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                let jsonMatch = resultText.match(/\{[\s\S]*\}/);
                resultText = jsonMatch ? jsonMatch[0] : resultText;
                const parsed = JSON.parse(resultText);

                if (parsed.users && Array.isArray(parsed.users)) {
                    const isBusiness = filterTypeAtRequest === 'business';
                    parsed.users.forEach(u => {
                        const newSub = {
                            id: 'gen_user_' + Date.now() + Math.floor(Math.random()*10000),
                            name: u.name,
                            handle: u.name.toLowerCase().replace(/\s+/g, ''),
                            avatar: `https://picsum.photos/seed/${u.avatarDesc ? u.avatarDesc.replace(/\s+/g, '') : Date.now()}/80/80`,
                            isBusiness: isBusiness,
                            isFriend: false, // 默认都是陌生人，需要手动添加好友
                            isSubscribed: false, // 默认未订阅
                            dmHistory: u.messages.map(m => {
                                if (m.type === 'offer') {
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        isOffer: true,
                                        offerData: m.offerData || { title: '合作邀请', offerType: 'video', requirement: '详谈', price: '￥5000', penalty: '￥2000' },
                                        offerStatus: 'pending' // pending, accepted, rejected, completed, failed
                                    };
                                } else {
                                    return {
                                        type: 'char',
                                        name: u.name,
                                        text: m.content || m.text || (typeof m === 'string' ? m : "你好")
                                    };
                                }
                            })
                        };
                        mockSubscriptions.unshift(newSub);
                    });
                    saveYoutubeData();
                    renderMessagesList();
                    if(window.showToast) window.showToast(`收到 ${parsed.users.length} 位新联系人的消息`);
                }

            } catch (e) {
                console.error("Generate MSG Error: ", e);
                if(window.showToast) window.showToast('无法生成新消息，请重试');
            } finally {
                msgRefreshBtn.style.opacity = '1';
                msgRefreshBtn.style.pointerEvents = 'auto';
            }
        });
    }

    if (msgFilterDm && msgFilterCommunity && msgFilterBusiness) {
        msgFilterDm.addEventListener('click', () => {
            msgFilterDm.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'dm';
            renderMessagesList();
        });
        msgFilterCommunity.addEventListener('click', () => {
            msgFilterCommunity.classList.add('active');
            msgFilterDm.classList.remove('active');
            msgFilterBusiness.classList.remove('active');
            currentMsgFilter = 'community';
            renderMessagesList();
        });
        msgFilterBusiness.addEventListener('click', () => {
            msgFilterBusiness.classList.add('active');
            msgFilterCommunity.classList.remove('active');
            msgFilterDm.classList.remove('active');
            currentMsgFilter = 'business';
            renderMessagesList();
        });
    }

    function renderMessagesList() {
        if (!msgListContainer) return;
        msgListContainer.innerHTML = '';

        if (currentMsgFilter === 'business' || currentMsgFilter === 'dm') {
            const isBusiness = currentMsgFilter === 'business';
            const allTargetSubs = mockSubscriptions.filter(sub => sub.isBusiness === isBusiness && (sub.isFriend || (sub.dmHistory && sub.dmHistory.length > 0)));
            
            if (allTargetSubs.length === 0) {
                msgListContainer.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                        <i class="fas ${isBusiness ? 'fa-envelope-open-text' : 'fa-comment-dots'}" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                        <p style="font-size: 15px;">暂无${isBusiness ? '商务' : '私信'}消息</p>
                    </div>
                `;
                return;
            }

            const friends = allTargetSubs.filter(s => s.isFriend);
            const strangers = allTargetSubs.filter(s => !s.isFriend);

            const renderSubList = (subsArr, title) => {
                if (subsArr.length === 0) return '';
                const wrapper = document.createElement('div');
                wrapper.innerHTML = `<div style="font-size: 14px; font-weight: 600; color: #8e8e93; margin: 16px 4px 8px;">${title} (${subsArr.length})</div>`;
                
                const listWrapper = document.createElement('div');
                listWrapper.style.backgroundColor = '#ffffff';
                listWrapper.style.borderRadius = '16px';
                listWrapper.style.overflow = 'hidden';
                listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

                subsArr.forEach((sub, index) => {
                    const el = document.createElement('div');
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.gap = '15px';
                    el.style.cursor = 'pointer';
                    el.style.padding = '16px';
                    el.style.backgroundColor = '#ffffff';
                    if (index < subsArr.length - 1) {
                        el.style.borderBottom = '1px solid #f2f2f2';
                    }
                    
                    const lastMsg = sub.dmHistory[sub.dmHistory.length - 1];
                    let lastMsgText = lastMsg.isOffer ? '[商单邀请]' : (lastMsg.text || '...');
                    let lastMsgTime = '刚刚';

                    const badgeHtml = sub.isBusiness ? `<span style="font-size:10px; background:#e8f5e9; color:#388e3c; padding:2px 4px; border-radius:4px; margin-left:4px;">商务</span>` : '';

                    el.innerHTML = `
                        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                            <img src="${sub.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div style="flex: 1; overflow: hidden;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                                <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${sub.name} ${badgeHtml}</div>
                                <div style="font-size: 12px; color: #8e8e93;">${lastMsgTime}</div>
                            </div>
                            <div style="font-size: 13px; color: #606060; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${lastMsgText}</div>
                        </div>
                    `;
                    
                    el.addEventListener('click', () => {
                        currentSubChannelData = sub;
                        openDMChat(sub);
                    });
                    
                    listWrapper.appendChild(el);
                });
                wrapper.appendChild(listWrapper);
                return wrapper;
            };

            if (friends.length > 0) {
                msgListContainer.appendChild(renderSubList(friends, '我的好友'));
            }
            if (strangers.length > 0) {
                msgListContainer.appendChild(renderSubList(strangers, '消息请求'));
            }
            return;
        }

        // Community Tab - Render joined fan groups
        let joinedGroups = [];
        mockSubscriptions.forEach(sub => {
            if (sub.generatedContent && sub.generatedContent.fanGroup && sub.generatedContent.fanGroup.isJoined) {
                joinedGroups.push({
                    subData: sub,
                    group: sub.generatedContent.fanGroup
                });
            }
        });

        if (joinedGroups.length === 0) {
            msgListContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 100px; color: #8e8e93;">
                    <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; color: #d1d1d6;"></i>
                    <p style="font-size: 15px;">你还没有加入任何粉丝群</p>
                </div>
            `;
            return;
        }

        const listWrapper = document.createElement('div');
        listWrapper.style.backgroundColor = '#ffffff';
        listWrapper.style.borderRadius = '16px';
        listWrapper.style.overflow = 'hidden';
        listWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

        joinedGroups.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '15px';
            el.style.cursor = 'pointer';
            el.style.padding = '16px';
            el.style.backgroundColor = '#ffffff';
            if (index < joinedGroups.length - 1) {
                el.style.borderBottom = '1px solid #f2f2f2';
            }
            
            let groupAvatarHtml = `
                <div style="width: 50px; height: 50px; border-radius: 50%; background: #ffcc00; display: flex; justify-content: center; align-items: center; color: white; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                    <i class="fas fa-users" style="font-size: 20px;"></i>
                </div>
            `;
            
            if (item.group.avatar) {
                groupAvatarHtml = `
                    <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <img src="${item.group.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                `;
            }
            
            el.innerHTML = `
                ${groupAvatarHtml}
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-size: 16px; font-weight: 600; color: #0f0f0f; margin-bottom: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.group.name || '粉丝群'}</div>
                    <div style="font-size: 13px; color: #606060; display: flex; align-items: center; gap: 6px;">
                        <img src="${item.subData.avatar}" style="width: 16px; height: 16px; border-radius: 50%;"> 
                        <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.subData.name} 的专属社群 • ${item.group.memberCount || '3000人'}</span>
                    </div>
                </div>
                <div style="color: #ccc;"><i class="fas fa-chevron-right"></i></div>
            `;
            
            el.addEventListener('click', () => {
                currentSubChannelData = item.subData; // Required for openFanGroupChat to know context
                openFanGroupChat(item.group);
            });
            
            listWrapper.appendChild(el);
        });
        msgListContainer.appendChild(listWrapper);
    }


    function updateNavIndicator(activeItem) {
        if (!activeItem || !navIndicator) return;
        const containerRect = activeItem.parentElement.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const relativeLeft = itemRect.left - containerRect.left;
        navIndicator.style.width = `${itemRect.width}px`;
        navIndicator.style.left = `${relativeLeft}px`;
    }

    setTimeout(() => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    }, 100);

    const ytCreateSheet = document.getElementById('yt-create-sheet');
    const ytNavPlusBtn = document.getElementById('yt-nav-plus-btn');

    if(ytNavPlusBtn && ytCreateSheet) {
        ytNavPlusBtn.addEventListener('click', () => {
            ytCreateSheet.classList.add('active');
        });

        ytCreateSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytCreateSheet) {
                ytCreateSheet.classList.remove('active');
            }
        });
        
        const createBtns = ytCreateSheet.querySelectorAll('.yt-create-bubble-btn');
        createBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                ytCreateSheet.classList.remove('active');
            });
        });
    }

    navItems.forEach((item) => {
        item.addEventListener('click', () => {
            if(item.classList.contains('yt-nav-item-center')) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            updateNavIndicator(item);

            const targetId = item.getAttribute('data-target');
            tabContents.forEach(tab => {
                if (tab.id === targetId) {
                    tab.classList.add('active');
                    // Add hook for rendering messages
                    if (targetId === 'yt-messages-tab') {
                        renderMessagesList();
                    }
                } else {
                    tab.classList.remove('active');
                }
            });
        });
    });
    
    window.addEventListener('resize', () => {
        const activeNav = document.querySelector('.yt-nav-item.active');
        if(activeNav) updateNavIndicator(activeNav);
    });

    // 5. Data Rendering Logic
    function renderSubscriptions() {
        if (!subsList) return;
        subsList.innerHTML = '';

        document.querySelector('.yt-subscriptions-wrapper').style.display = 'flex';

        if (!hasSubscriptions || mockSubscriptions.length === 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
            return;
        }

        // Only render actually subscribed channels in the top bar
        const realSubscriptions = mockSubscriptions.filter(s => s.isSubscribed !== false);
        
        if (realSubscriptions.length === 0 && mockSubscriptions.length > 0) {
            const el = document.createElement('div');
            el.className = `yt-sub-item`;
            el.innerHTML = `
                <div class="yt-sub-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <span class="yt-sub-name">暂无订阅</span>
            `;
            subsList.appendChild(el);
        } else {
            realSubscriptions.forEach(sub => {
                const el = document.createElement('div');
                el.className = `yt-sub-item ${sub.isLive ? 'has-live' : ''}`;
                el.innerHTML = `
                    <div class="yt-sub-avatar">
                        <img src="${sub.avatar}" alt="${sub.name}">
                    </div>
                    <span class="yt-sub-name">${sub.name}</span>
                `;
                el.addEventListener('click', () => {
                    openSubChannelView(sub);
                });
                subsList.appendChild(el);
            });
        }

        const allBtn = document.querySelector('.yt-sub-all-btn');
        const allSubsSheet = document.getElementById('yt-all-subs-sheet');
        if(allBtn && allSubsSheet) {
            allBtn.onclick = () => {
                const list = document.getElementById('yt-all-subs-list');
                list.innerHTML = '';
                mockSubscriptions.forEach(sub => {
                    const item = document.createElement('div');
                    item.className = 'account-card';
                    item.innerHTML = `
                        <div class="account-content" style="cursor:pointer;">
                            <div class="account-avatar"><img src="${sub.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                            <div class="account-info">
                                <div class="account-name">${sub.name}</div>
                                <div class="account-detail">${sub.subs || '0'} 订阅者</div>
                            </div>
                        </div>
                    `;
                    item.addEventListener('click', () => {
                        allSubsSheet.classList.remove('active');
                        openSubChannelView(sub);
                    });
                    list.appendChild(item);
                });
                allSubsSheet.classList.add('active');
            };
            
            allSubsSheet.addEventListener('mousedown', (e) => {
                if(e.target === allSubsSheet) allSubsSheet.classList.remove('active');
            });
        }
    }

    let currentFilter = '全部';

    filterBubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            filterBubbles.forEach(b => b.classList.remove('active'));
            bubble.classList.add('active');
            currentFilter = bubble.textContent;
            renderVideos();
        });
    });

    function renderVideos() {
        if (!liveSection || !emptyState) return;
        liveSection.innerHTML = '';

        let filteredVideos = mockVideos;
        if (currentFilter === '正在直播') {
            filteredVideos = mockVideos.filter(v => v.isLive);
        }

        if (filteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        liveSection.style.display = 'flex';
        emptyState.style.display = 'none';

        // Only show videos from subscribed channels
        const realFilteredVideos = filteredVideos.filter(v => v.channelData && v.channelData.isSubscribed !== false);
        
        if (realFilteredVideos.length === 0) {
            liveSection.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('p').textContent = '暂无符合条件的视频';
            return;
        }

        realFilteredVideos.forEach(video => {
            const channel = video.channelData;
            const liveBadgeHtml = video.isLive ? `<div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>` : '';

            const el = document.createElement('div');
            el.className = 'yt-video-card';
            el.innerHTML = `
                <div class="yt-video-thumbnail">
                    <img src="${video.thumbnail || 'https://picsum.photos/320/180'}" alt="Thumbnail">
                    ${liveBadgeHtml}
                </div>
                <div class="yt-video-info">
                    <div class="yt-video-avatar" style="cursor: pointer; border: 1px solid #e5e5e5; transition: transform 0.2s;">
                        <img src="${channel.avatar || 'https://picsum.photos/80/80'}" alt="${channel.name}">
                    </div>
                    <div class="yt-video-details">
                        <h3 class="yt-video-title">${video.title || '无标题'}</h3>
                        <p class="yt-video-meta">${channel.name} • ${video.views || '0'} • ${video.time || '刚刚'}</p>
                    </div>
                </div>
            `;
            
            el.addEventListener('click', () => {
                openVideoPlayer(video);
            });

            const avatarBtn = el.querySelector('.yt-video-avatar');
            avatarBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openSubChannelView(channel);
            });

            liveSection.appendChild(el);
        });
    }

    function syncYtProfile() {
        if (ytUserState) {
            const nameStr = ytUserState.name || 'User';
            if (profileName) profileName.textContent = nameStr;
            
            const handleStr = ytUserState.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            if (profileHandle) profileHandle.textContent = '@' + handleStr;
            
            if (ytUserState.avatarUrl) {
                if (profileAvatarImg) {
                    profileAvatarImg.src = ytUserState.avatarUrl;
                    profileAvatarImg.style.display = 'block';
                }
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
            } else {
                if (profileAvatarImg) profileAvatarImg.style.display = 'none';
                if (profileAvatarIcon) profileAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = `url('${channelState.bannerUrl}')`;
            } else if (profileHeaderBg) {
                profileHeaderBg.style.backgroundImage = 'none';
            }

            if (profileSubs) {
                profileSubs.textContent = `${ytUserState.subs || '0'} 订阅者`;
            }
            if (profileVideos) {
                profileVideos.textContent = `${ytUserState.videos || '0'} 视频`;
            }
        }
    }

    if (editChannelBtn && editChannelSheet) {
        editChannelBtn.addEventListener('click', () => {
            if (!ytUserState) return;
            const nameStr = ytUserState.name || '';
            const handleStr = ytUserState.handle || nameStr.toLowerCase().replace(/\s+/g, '');
            
            if(editNameInput) editNameInput.value = nameStr;
            if(editHandleInput) editHandleInput.value = handleStr;
            if(editUrlInput) editUrlInput.value = channelState.url || `youtube.com/@${handleStr}`;
            if(editSubsInput) editSubsInput.value = ytUserState.subs || '';
            if(editVideosInput) editVideosInput.value = ytUserState.videos || '';
            if(editPersonaInput) editPersonaInput.value = ytUserState.persona || '';
            
            if (ytUserState.avatarUrl && editAvatarImg) {
                editAvatarImg.src = ytUserState.avatarUrl;
                editAvatarImg.style.display = 'block';
                if(editAvatarIcon) editAvatarIcon.style.display = 'none';
            } else {
                if(editAvatarImg) editAvatarImg.style.display = 'none';
                if(editAvatarIcon) editAvatarIcon.style.display = 'block';
            }
            
            if (channelState.bannerUrl && editBannerImg) {
                editBannerImg.src = channelState.bannerUrl;
                editBannerImg.style.display = 'block';
            } else {
                if(editBannerImg) editBannerImg.style.display = 'none';
            }
            editChannelSheet.classList.add('active');
        });
    }

    if (editHandleInput && editUrlInput) {
        editHandleInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/^@/, '');
            editUrlInput.value = val ? `youtube.com/@${val}` : 'youtube.com/@';
        });
    }

    if (editBannerBtn && bannerUpload) {
        editBannerBtn.addEventListener('click', () => bannerUpload.click());
        bannerUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if(editBannerImg) {
                        editBannerImg.src = event.target.result;
                        editBannerImg.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (editAvatarWrapper && avatarUpload) {
        editAvatarWrapper.addEventListener('click', () => avatarUpload.click());
        avatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if(editAvatarImg) {
                        editAvatarImg.src = event.target.result;
                        editAvatarImg.style.display = 'block';
                    }
                    if(editAvatarIcon) editAvatarIcon.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (confirmEditBtn) {
        confirmEditBtn.addEventListener('click', () => {
            if (!ytUserState) ytUserState = {};
            if(editNameInput) ytUserState.name = editNameInput.value.trim();
            if(editHandleInput) ytUserState.handle = editHandleInput.value.trim().replace(/^@/, '');
            if(editSubsInput) ytUserState.subs = editSubsInput.value.trim();
            if(editVideosInput) ytUserState.videos = editVideosInput.value.trim();
            if(editPersonaInput) ytUserState.persona = editPersonaInput.value.trim();
            
            if (editAvatarImg && editAvatarImg.style.display === 'block' && editAvatarImg.src) {
                ytUserState.avatarUrl = editAvatarImg.src;
            }
            if (editBannerImg && editBannerImg.style.display === 'block' && editBannerImg.src) {
                channelState.bannerUrl = editBannerImg.src;
            }
            if(editUrlInput) channelState.url = editUrlInput.value.trim();

            syncYtProfile();
            if(editChannelSheet) editChannelSheet.classList.remove('active');
            saveYoutubeData();
            if (window.showToast) window.showToast('频道信息已保存');
        });
    }

    if (editChannelSheet) {
        editChannelSheet.addEventListener('mousedown', (e) => {
            if (e.target === editChannelSheet) {
                editChannelSheet.classList.remove('active');
            }
        });
    }

    // 8. Sub Channel View Logic
    const subChannelBackBtn = document.getElementById('sub-channel-back-btn');
    const subChannelContent = document.getElementById('sub-channel-content');
    const subChannelSubscribeBtn = document.getElementById('sub-channel-subscribe-btn');

    let currentSubChannelData = null;

    function openSubChannelView(sub) {
        try {
            if (!subChannelView) return;
            currentSubChannelData = sub;

            const nameEl = document.getElementById('sub-channel-name');
            if (nameEl) nameEl.textContent = sub.name || '未知';

            const handleEl = document.getElementById('sub-channel-handle');
            if (handleEl && sub.name) handleEl.textContent = `@${sub.name.toLowerCase().replace(/\s+/g, '')}`;

            const avatarEl = document.getElementById('sub-channel-avatar');
            if (avatarEl) {
                avatarEl.src = sub.avatar || 'https://picsum.photos/80/80';
                avatarEl.style.display = 'block';
            }
            
            const subBannerEl = document.getElementById('sub-channel-banner');
            if (subBannerEl) {
                if (sub.banner) {
                    subBannerEl.style.backgroundImage = `url('${sub.banner}')`;
                } else {
                    subBannerEl.style.backgroundImage = 'none';
                }
            }
            
            const displaySubs = sub.subs || '1.2万';
            const displayVideos = sub.videos || '45';
            
            const subsEl = document.getElementById('sub-channel-subs');
            if (subsEl) subsEl.textContent = `${displaySubs} 订阅者`;
            
            const videosEl = document.getElementById('sub-channel-videos');
            if (videosEl) videosEl.textContent = `${displayVideos} 视频`;
            
            if (subChannelContent) subChannelContent.innerHTML = ``;
            
            const tabsContainer = document.getElementById('sub-channel-tabs');
            if (tabsContainer) {
                const tabs = tabsContainer.querySelectorAll('.yt-sliding-tab');
                tabs.forEach(t => t.classList.remove('active'));
                if (tabs.length > 0) {
                    tabs[0].classList.add('active');
                    const indicator = tabsContainer.querySelector('.yt-tab-indicator');
                    if (indicator) updateSlidingIndicator(tabs[0], indicator);
                }
            }

            const foundSub = mockSubscriptions.find(s => s.id === sub.id);
            const isSubbed = foundSub && foundSub.isSubscribed !== false;
            if (subChannelSubscribeBtn) {
                if (isSubbed) {
                    subChannelSubscribeBtn.textContent = '已订阅';
                    subChannelSubscribeBtn.classList.add('subscribed');
                } else {
                    subChannelSubscribeBtn.textContent = '订阅';
                    subChannelSubscribeBtn.classList.remove('subscribed');
                }
            }

            subChannelView.classList.add('active');
            
            if(sub.generatedContent) {
                renderGeneratedContent('live');
            } else {
                renderGeneratedContent('live'); 
            }
        } catch (e) {
            console.error("Error opening sub channel view:", e);
            if(window.showToast) window.showToast('无法打开主页，出现异常');
        }
    }

    if (subChannelBackBtn) {
        subChannelBackBtn.addEventListener('click', () => {
            if (subChannelView) subChannelView.classList.remove('active');
        });
    }

    if (subChannelSubscribeBtn) {
        subChannelSubscribeBtn.addEventListener('click', function() {
            if (!currentSubChannelData) return;

            const subId = currentSubChannelData.id;
            const existingIndex = mockSubscriptions.findIndex(s => s.id === subId);

            if (this.classList.contains('subscribed')) {
                this.classList.remove('subscribed');
                this.textContent = '订阅';
                
                if (existingIndex > -1) {
                    mockSubscriptions[existingIndex].isSubscribed = false;
                    const realSubs = mockSubscriptions.filter(s => s.isSubscribed !== false);
                    hasSubscriptions = realSubs.length > 0;
                    renderSubscriptions(); 
                    
                    // Bug Fix: Update the list visually
                    renderVideos();
                }
            } else {
                this.classList.add('subscribed');
                this.textContent = '已订阅';
                
                if (existingIndex === -1) {
                    currentSubChannelData.isSubscribed = true;
                    mockSubscriptions.push(currentSubChannelData);
                } else {
                    mockSubscriptions[existingIndex].isSubscribed = true;
                }
                hasSubscriptions = true;
                renderSubscriptions();
                renderVideos();
            }
            saveYoutubeData();
        });
    }

    function updateSlidingIndicator(activeTab, indicator) {
        if (!activeTab || !indicator) return;
        indicator.style.width = `${activeTab.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    }

    function initSlidingTabs(containerId, onChangeCallback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const tabs = container.querySelectorAll('.yt-sliding-tab');
        const indicator = container.querySelector('.yt-tab-indicator');

        setTimeout(() => {
            const active = container.querySelector('.yt-sliding-tab.active') || tabs[0];
            updateSlidingIndicator(active, indicator);
        }, 50);

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateSlidingIndicator(tab, indicator);
                if (onChangeCallback) {
                    onChangeCallback(tab.getAttribute('data-target') || tab.textContent.trim());
                }
            });
        });
    }

    initSlidingTabs('profile-main-tabs', (target) => {
        const container = document.getElementById('yt-profile-content-list');
        if(!container) return;
        
        container.innerHTML = '';
        
        if(target === 'live') {
            const activeLive = mockVideos.find(v => v.channelData && v.channelData.id === 'user_channel_id');
            if (activeLive) {
                const el = document.createElement('div');
                el.innerHTML = `
                    <div class="yt-video-card yt-live-pin-card" style="margin: 16px;">
                        <div class="yt-video-thumbnail">
                            <img src="${activeLive.thumbnail}" alt="Live">
                            <div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>
                        </div>
                        <div class="yt-video-info" style="padding: 12px;">
                            <div class="yt-video-details">
                                <h3 class="yt-video-title">${activeLive.title || '无标题'}</h3>
                                <p class="yt-video-meta">${activeLive.views || '正在观看'}</p>
                            </div>
                        </div>
                    </div>
                `;
                el.querySelector('.yt-video-card').addEventListener('click', () => {
                    const userLiveView = document.getElementById('yt-user-live-view');
                    if (userLiveView) userLiveView.classList.add('active');
                });
                container.appendChild(el);
            } else {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-video-slash" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                        <p style="font-size: 14px;">暂未开播</p>
                    </div>
                `;
            }
        } else if (target === 'past') {
            if (channelState.pastVideos && channelState.pastVideos.length > 0) {
                const listWrapper = document.createElement('div');
                listWrapper.className = 'yt-history-list';
                listWrapper.style.padding = '16px';
                
                channelState.pastVideos.forEach((v, index) => {
                    const item = document.createElement('div');
                    item.className = 'yt-history-item';
                    item.style.position = 'relative';
                    item.innerHTML = `
                        <div class="yt-history-thumb">
                            <img src="${v.thumbnail}" alt="VOD">
                            <div class="yt-history-time">${Math.floor(Math.random() * 2)+1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}</div>
                        </div>
                        <div class="yt-history-info">
                            <h3 class="yt-history-title">${v.title || '无标题'}</h3>
                            <p class="yt-history-meta">${v.views || '0 次观看'} • ${v.time || '刚刚'}</p>
                        </div>
                        <div class="yt-history-delete-btn" style="position: absolute; right: 10px; top: 10px; background: rgba(0,0,0,0.5); width: 28px; height: 28px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #fff; cursor: pointer; z-index: 10;">
                            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                        </div>
                    `;
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.yt-history-delete-btn')) {
                            e.stopPropagation();
                            window.showCustomModal({
                                title: '删除视频',
                                message: '确定要删除这个往期视频吗？',
                                confirmText: '删除',
                                cancelText: '取消',
                                isDestructive: true,
                                onConfirm: () => {
                                    channelState.pastVideos.splice(index, 1);
                                    saveYoutubeData();
                                    const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
                                    if(activeTab) activeTab.click();
                                    if(window.showToast) window.showToast('视频已删除');
                                }
                            });
                            return;
                        }
                        openVideoPlayer({
                            title: v.title,
                            views: v.views,
                            thumbnail: v.thumbnail,
                            isLive: false,
                            guest: v.guest || null,
                            channelData: {
                                id: 'user_channel_id',
                                name: ytUserState ? ytUserState.name : '我',
                                avatar: ytUserState ? ytUserState.avatarUrl : 'https://picsum.photos/80/80',
                                subs: ytUserState ? ytUserState.subs : '0'
                            },
                            comments: v.comments || []
                        });
                    });
                    listWrapper.appendChild(item);
                });
                container.appendChild(listWrapper);
            } else {
                container.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                        <i class="fas fa-film" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                        <p style="font-size: 14px;">暂无往期视频</p>
                    </div>
                `;
            }
        } else if (target === 'community') {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #8e8e93;">
                    <i class="fas fa-users" style="font-size: 40px; margin-bottom: 10px; color: #d1d1d6;"></i>
                    <p style="font-size: 14px;">暂无社群动态</p>
                </div>
            `;
        }
    });

    initSlidingTabs('sub-channel-tabs', (target) => {
        renderGeneratedContent(target);
    });

    const addYtCharSheet = document.getElementById('add-yt-char-sheet');
    const ytCharAvatarWrapper = document.getElementById('yt-char-avatar-wrapper');
    const ytCharAvatarUpload = document.getElementById('yt-char-avatar-upload');
    const ytCharAvatarImg = document.getElementById('yt-char-avatar-img');
    const ytCharBannerBtn = document.getElementById('yt-char-banner-btn');
    const ytCharBannerUpload = document.getElementById('yt-char-banner-upload');
    const ytCharBannerImg = document.getElementById('yt-char-banner-img');
    const confirmAddYtCharBtn = document.getElementById('confirm-add-yt-char-btn');
    const charNameInput = document.getElementById('yt-char-name-input');
    const charHandleInput = document.getElementById('yt-char-handle-input');
    const charDescInput = document.getElementById('yt-char-desc-input');
    const charSubsInput = document.getElementById('yt-char-subs-input');
    const charVideosInput = document.getElementById('yt-char-videos-input');
    const charAvatarIcon = document.getElementById('yt-char-avatar-preview')?.querySelector('i');

    let isEditingChar = false;

    function openCustomCharSheet(charData = null) {
        if(addYtCharSheet) {
            if (charData) {
                isEditingChar = true;
                const titleEl = addYtCharSheet.querySelector('.sheet-title');
                if(titleEl) titleEl.textContent = '编辑频道角色';
                if(confirmAddYtCharBtn) confirmAddYtCharBtn.textContent = '保存修改';
                
                if(charNameInput) charNameInput.value = charData.name || '';
                if(charHandleInput) charHandleInput.value = (charData.handle || charData.name.toLowerCase().replace(/\s+/g, '')) || '';
                if(charDescInput) charDescInput.value = charData.desc || '';
                if(charSubsInput) charSubsInput.value = charData.subs || '';
                if(charVideosInput) charVideosInput.value = charData.videos || '';
                
                if(ytCharAvatarImg && charData.avatar) {
                    ytCharAvatarImg.src = charData.avatar;
                    ytCharAvatarImg.style.display = 'block';
                    if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                }
                
                if(ytCharBannerImg && charData.banner) {
                    ytCharBannerImg.src = charData.banner;
                    ytCharBannerImg.style.display = 'block';
                } else if (ytCharBannerImg) {
                    ytCharBannerImg.style.display = 'none';
                }
            } else {
                isEditingChar = false;
                const titleEl = addYtCharSheet.querySelector('.sheet-title');
                if(titleEl) titleEl.textContent = '自定义频道角色';
                if(confirmAddYtCharBtn) confirmAddYtCharBtn.textContent = '生成频道并开播';
                
                if(charNameInput) charNameInput.value = '';
                if(charHandleInput) charHandleInput.value = '';
                if(charDescInput) charDescInput.value = '';
                if(charSubsInput) charSubsInput.value = '';
                if(charVideosInput) charVideosInput.value = '';
                
                if(ytCharAvatarImg) { ytCharAvatarImg.src = ''; ytCharAvatarImg.style.display = 'none'; }
                if(charAvatarIcon) charAvatarIcon.style.display = 'block';
                if(ytCharBannerImg) { ytCharBannerImg.src = ''; ytCharBannerImg.style.display = 'none'; }
            }
            
            addYtCharSheet.classList.add('active');
        }
    }

    const mainSearchBtn = document.getElementById('yt-main-search-btn');
    const mainSettingsBtn = document.getElementById('yt-main-settings-btn');
    
    const openCreateSheetHandler = (e) => {
        e.stopPropagation();
        openCustomCharSheet(null);
    };

    if (mainSearchBtn) mainSearchBtn.addEventListener('click', openCreateSheetHandler);

    const charEditBtn = document.getElementById('yt-char-edit-btn');
    if (charEditBtn) {
        charEditBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentSubChannelData) {
                openCustomCharSheet(currentSubChannelData);
            }
        });
    }

    if (ytCharAvatarWrapper && ytCharAvatarUpload) {
        ytCharAvatarWrapper.addEventListener('click', () => ytCharAvatarUpload.click());
        ytCharAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if(ytCharAvatarImg) {
                        ytCharAvatarImg.src = event.target.result;
                        ytCharAvatarImg.style.display = 'block';
                    }
                    if(charAvatarIcon) charAvatarIcon.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (ytCharBannerBtn && ytCharBannerUpload) {
        ytCharBannerBtn.addEventListener('click', () => ytCharBannerUpload.click());
        ytCharBannerUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (ytCharBannerImg) {
                        ytCharBannerImg.src = event.target.result;
                        ytCharBannerImg.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (confirmAddYtCharBtn) {
        confirmAddYtCharBtn.addEventListener('click', () => {
            const name = charNameInput?.value.trim() || '神秘新星';
            const handle = charHandleInput?.value.trim() || name.toLowerCase().replace(/\s+/g, '');
            const desc = charDescInput?.value.trim() || '这个频道很神秘，什么都没写...';
            const subs = charSubsInput?.value.trim() || '1.2万';
            const videos = charVideosInput?.value.trim() || '10';
            
            let avatarUrl = 'https://picsum.photos/seed/' + Math.random() + '/80/80';
            if (ytCharAvatarImg && ytCharAvatarImg.style.display === 'block' && ytCharAvatarImg.src) {
                avatarUrl = ytCharAvatarImg.src;
            } else if (isEditingChar && currentSubChannelData && currentSubChannelData.avatar) {
                avatarUrl = currentSubChannelData.avatar; 
            }

            let bannerUrl = null;
            if (ytCharBannerImg && ytCharBannerImg.style.display === 'block' && ytCharBannerImg.src) {
                bannerUrl = ytCharBannerImg.src;
            } else if (isEditingChar && currentSubChannelData && currentSubChannelData.banner) {
                bannerUrl = currentSubChannelData.banner;
            }

            if (isEditingChar && currentSubChannelData) {
                // Update
                currentSubChannelData.name = name;
                currentSubChannelData.handle = handle;
                currentSubChannelData.desc = desc;
                currentSubChannelData.subs = subs;
                currentSubChannelData.videos = videos;
                currentSubChannelData.avatar = avatarUrl;
                currentSubChannelData.banner = bannerUrl;
                
                const subIndex = mockSubscriptions.findIndex(s => s.id === currentSubChannelData.id);
                if (subIndex > -1) {
                    mockSubscriptions[subIndex] = currentSubChannelData;
                }
                
                renderSubscriptions();
                openSubChannelView(currentSubChannelData);
                if (window.showToast) window.showToast('角色信息已更新！');
                
            } else {
                // Create
                const newCharData = {
                    id: 'char_custom_' + Date.now(),
                    name: name,
                    handle: handle,
                    avatar: avatarUrl,
                    banner: bannerUrl,
                    isLive: true,
                    desc: desc,
                    subs: subs,
                    videos: videos,
                    isFriend: false,
                    isBusiness: false
                };

                // Remove the logic that auto pushes to mockSubscriptions directly without user subscribing
                // if (!mockSubscriptions.some(s => s.id === newCharData.id)) {
                //    mockSubscriptions.push(newCharData);
                //    hasSubscriptions = true;
                // }

                renderSubscriptions();
                openSubChannelView(newCharData);
                if (window.showToast) window.showToast('频道已生成，点击订阅即可关注！');
            }
            saveYoutubeData();
            if(addYtCharSheet) addYtCharSheet.classList.remove('active');
        });
    }

    if (addYtCharSheet) {
        addYtCharSheet.addEventListener('mousedown', (e) => {
            if (e.target === addYtCharSheet) {
                addYtCharSheet.classList.remove('active');
            }
        });
    }
    

    // --- YouTube Settings & Binding Logic ---
    const ytSettingsSheet = document.getElementById('yt-settings-sheet');
    const ytBindWbBtn = document.getElementById('yt-bind-wb-btn');
    const bindWbSheet = document.getElementById('bind-world-book-sheet');
    const ytPromptSheet = document.getElementById('yt-prompt-sheet');
    const ytExportDataBtn = document.getElementById('yt-export-data-btn');
    const ytImportDataBtn = document.getElementById('yt-import-data-btn');
    const ytImportDataFile = document.getElementById('yt-import-data-file');
    const ytClearDataBtn = document.getElementById('yt-clear-data-btn');

    if (ytExportDataBtn) {
        ytExportDataBtn.addEventListener('click', () => {
            const dataToExport = {
                channelState: channelState,
                subscriptions: mockSubscriptions,
                userState: ytUserState
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "youtube_emulator_data.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            if(window.showToast) window.showToast('数据已导出');
            if(ytSettingsSheet) ytSettingsSheet.classList.remove('active');
        });
    }

    if (ytImportDataBtn && ytImportDataFile) {
        ytImportDataBtn.addEventListener('click', () => ytImportDataFile.click());
        ytImportDataFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    if (importedData.channelState) channelState = importedData.channelState;
                    if (importedData.subscriptions) {
                        mockSubscriptions = importedData.subscriptions;
                        hasSubscriptions = mockSubscriptions.length > 0;
                        mockVideos = [];
                        mockSubscriptions.forEach(sub => {
                            if (sub.generatedContent && sub.generatedContent.currentLive) {
                                mockVideos.push({
                                    title: sub.generatedContent.currentLive.title,
                                    views: sub.generatedContent.currentLive.views,
                                    time: 'LIVE',
                                    thumbnail: sub.generatedContent.currentLive.thumbnail || 'https://picsum.photos/320/180',
                                    isLive: true,
                                    comments: sub.generatedContent.currentLive.comments || [],
                                    initialBubbles: sub.generatedContent.currentLive.initialBubbles || [],
                                    guest: sub.generatedContent.currentLive.guest || null,
                                    channelData: sub
                                });
                            }
                        });
                    }
                    if (importedData.userState) ytUserState = importedData.userState;
                    
                    saveYoutubeData();
                    syncYtProfile();
                    renderSubscriptions();
                    renderVideos();
                    renderMessagesList();
                    
                    if(window.showToast) window.showToast('数据导入成功');
                    if(ytSettingsSheet) ytSettingsSheet.classList.remove('active');
                } catch (err) {
                    console.error("Import Error:", err);
                    if(window.showToast) window.showToast('导入失败，数据格式错误');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    if (ytClearDataBtn) {
        ytClearDataBtn.addEventListener('click', () => {
            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '清空所有数据',
                    message: '确定要清空 YouTube 模拟器的所有数据吗？这包括频道状态、订阅、所有视频和聊天记录。此操作不可恢复。',
                    isDestructive: true,
                    confirmText: '清空',
                    onConfirm: () => {
                        localStorage.removeItem('yt_channel_state');
                        localStorage.removeItem('yt_subscriptions');
                        localStorage.removeItem('yt_user_state');
                        
                        // Reset memory state
                        channelState = {
                            bannerUrl: null,
                            url: '',
                            boundWorldBookIds: [],
                            systemPrompt: '',
                            summaryPrompt: '',
                            groupChatPrompt: '',
                            vodPrompt: '',
                            postPrompt: '',
                            liveSummaries: [],
                            groupChatHistory: [],
                            cachedTrendingLive: null,
                            cachedTrendingSub: null
                        };
                        mockSubscriptions = [];
                        hasSubscriptions = false;
                        mockVideos = [];
                        ytUserState = null;
                        if (window.userState) ytUserState = { ...window.userState };
                        
                        syncYtProfile();
                        renderSubscriptions();
                        renderVideos();
                        renderMessagesList();
                        
                        if(window.showToast) window.showToast('所有数据已清空');
                        if(ytSettingsSheet) ytSettingsSheet.classList.remove('active');
                    }
                });
            } else {
                if (confirm('确定要清空所有数据吗？此操作不可恢复。')) {
                    localStorage.removeItem('yt_channel_state');
                    localStorage.removeItem('yt_subscriptions');
                    localStorage.removeItem('yt_user_state');
                    location.reload();
                }
            }
        });
    }

    if (mainSettingsBtn && ytSettingsSheet) {
        mainSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            ytSettingsSheet.classList.add('active');
        });
        
        ytSettingsSheet.addEventListener('mousedown', (e) => {
            if(e.target === ytSettingsSheet) ytSettingsSheet.classList.remove('active');
        });
    }

    if (ytBindWbBtn && bindWbSheet) {
        ytBindWbBtn.addEventListener('click', () => {
            ytSettingsSheet.classList.remove('active');
            renderWbBindList();
            bindWbSheet.classList.add('active');
        });
    }

    let tempBoundIds = [];

    if (ytBindWbBtn && bindWbSheet) {
        ytBindWbBtn.addEventListener('click', () => {
            ytSettingsSheet.classList.remove('active');
            tempBoundIds = [...(channelState.boundWorldBookIds || [])];
            renderWbBindList();
            bindWbSheet.classList.add('active');
        });
    }

    const confirmBindWbBtn = document.getElementById('confirm-bind-world-book-btn');
    if (confirmBindWbBtn) {
        confirmBindWbBtn.addEventListener('click', () => {
            channelState.boundWorldBookIds = [...tempBoundIds];
            const nameEl = document.getElementById('yt-bound-wb-name');
            if (nameEl) {
                if (channelState.boundWorldBookIds.length === 0) {
                    nameEl.textContent = '未绑定';
                } else if (channelState.boundWorldBookIds.length === 1) {
                    const wbs = window.getWorldBooks ? window.getWorldBooks() : [];
                    const wb = wbs.find(w => w.id === channelState.boundWorldBookIds[0]);
                    nameEl.textContent = wb ? wb.name : '已绑定 1 本';
                } else {
                    nameEl.textContent = `已绑定 ${channelState.boundWorldBookIds.length} 本`;
                }
            }
            saveYoutubeData();
            if(window.showToast) window.showToast('世界书绑定成功');
            bindWbSheet.classList.remove('active');
        });
    }

    function renderWbBindList() {
        const list = document.getElementById('bind-world-book-list');
        if(!list) return;
        list.innerHTML = '';
        
        const wbs = window.getWorldBooks ? window.getWorldBooks() : [];
        if (wbs.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:#8e8e93;">暂无世界书，请先在主界面创建</div>`;
            return;
        }

        wbs.forEach(wb => {
            const isSelected = tempBoundIds.includes(wb.id);
            const tokens = window.calculateTokens ? window.calculateTokens(wb.entries) : 0;
            
            const item = document.createElement('div');
            item.className = 'account-card';
            item.style.padding = '12px 16px';
            item.style.height = 'auto';
            item.style.cursor = 'pointer';
            item.style.borderRadius = '16px';
            item.style.border = isSelected ? '2px solid var(--blue-color)' : '2px solid transparent';
            item.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
            item.style.position = 'relative';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; background-color: #1c1c1e; border-radius: 10px; display: flex; justify-content: center; align-items: center; color: #fff; font-size: 16px;">
                            <i class="fas fa-book"></i>
                        </div>
                        <div>
                            <div style="font-size: 16px; font-weight: 500; color: #000;">${wb.name}</div>
                            <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">分组: ${wb.group || '未分组'}</div>
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
            
            const styleFix = document.createElement('style');
            styleFix.innerHTML = `#bind-world-book-list .account-card::after { display: none !important; }`;
            item.appendChild(styleFix);

            item.addEventListener('click', () => {
                if (tempBoundIds.includes(wb.id)) {
                    tempBoundIds = tempBoundIds.filter(id => id !== wb.id);
                } else {
                    tempBoundIds.push(wb.id);
                }
                renderWbBindList();
            });
            
            list.appendChild(item);
        });
    }

    // Prompt Settings
    const ytPromptInput = document.getElementById('yt-prompt-input');
    const promptTabLive = document.getElementById('prompt-tab-live');
    const promptTabSummary = document.getElementById('prompt-tab-summary');
    const promptTabGroup = document.getElementById('prompt-tab-group');
    const promptDesc = document.getElementById('yt-prompt-desc');
    let currentPromptTab = 'live';

    const defaultPrompt = `你正在进行YouTube直播，你的名字是"{char}"。
你的人设和简介："{char_persona}"。
当前和你互动的是观众"{user}"，ta的人设："{user_persona}"。
世界观背景：{wb_context}
最近的直播经历：{live_summary_context}
{context_clue}
{msg_context}

请根据你的设定，生成符合你人设风格的直播回应。
具体要求：
1. charBubbles: 主播（你）的回应。
   - 如果用户发送了消息或SC，你要针对性地回复用户"{user}"。
   - 如果是继续直播，则是对大家说话，推动直播流程。
   - 返回1-3条气泡（字符串数组）。每条限制在30字内，只包含动作与语言。
2. passerbyComments: 路人观众在公屏发表的评论（吃瓜群众）。**注意：主播（Char）的回复绝对不要出现在这里！**
3. randomSuperChat: （可选）随机生成一条其他人的打赏。

必须返回严格的 JSON 格式，如下：
{
  "charBubbles": ["第一句话", "第二句话（可选）"],
  "passerbyComments": [
    {"name": "路人甲", "text": "弹幕内容"},
    {"name": "路人乙", "text": "弹幕内容"}
  ],
  "randomSuperChat": {
    "hasSuperChat": true,
    "name": "富哥",
    "amount": 50,
    "text": "主播辛苦了",
    "color": "#00bfa5"
  }
}`;

    const defaultSummaryPrompt = `请为刚刚结束的这场直播写一份“直播总结报告”。
你的名字是"{char}"。你的人设和简介："{char_persona}"。
这场直播中与你互动的主要观众是"{user}"。
当前时间：{current_time}
以下是本次直播的真实聊天记录摘要：
{chat_history}

请严格基于上述聊天记录生成一份详细的直播回忆总结，不要编造不存在的情节。
要求：
1. 字数控制在200字以内，简化描述，去除冗余修饰。
2. 专注于核心互动、关键事件和直播间的整体氛围。
3. 包含 date, title, content, interaction, atmosphere 字段。

返回严格的 JSON 格式：
{
  "date": "使用当前真实时间",
  "title": "简短标题",
  "content": "简要概括做了什么",
  "interaction": "与观众的互动亮点",
  "atmosphere": "整体氛围",
  "newSubs": 150
}`;

    const defaultGroupChatPrompt = `你正在粉丝群里水群，你的名字是"{char}"。
你的人设和简介："{char_persona}"。
用户"{user}"也在群里，ta的人设："{user_persona}"。
世界观背景：{wb_context}
最近的直播经历：{live_summary_context}

群聊历史记录：
{chat_history}

{trigger_instruction}

请生成群聊回复。
返回严格的 JSON 格式：
{
  "charReplies": ["你的第一句回复", "你的第二句回复（可选，分段发送更真实）"],
  "otherFansReplies": [
    {"name": "粉丝A", "text": "回复内容"},
    {"name": "粉丝B", "text": "回复内容"}
  ]
}
注意：
1. 气泡要简短！每条回复（包括你的和其他粉丝的）**绝对不要超过25个字**。
2. charReplies 必须是一个字符串数组。请模仿真实聊天，将你想说的话拆分成1-3条极短的消息分开发送。
3. otherFansReplies 中的每个粉丝也应该只发极短的句子。如果一个粉丝要说多句话，请将其拆分成多个对象（同名）。
4. 语气要口语化、松弛。`;

    const defaultVODPrompt = `用户"{user}"在你的往期视频或贴文下发表了评论。
内容主题："{video_title}"
你的名字："{char}"，人设："{char_persona}"。
用户人设："{user_persona}"。
世界观：{wb_context}

用户评论内容："{msg}"

请生成回复。返回严格的 JSON 格式：
{
  "charReplies": ["你的回复内容（可以是1-3条短句）"],
  "fanReplies": [
    {"name": "路人粉", "text": "路人的简短评论"},
    {"name": "黑粉", "text": "路人的简短评论"}
  ]
}`;

    if (promptTabLive && promptTabSummary && promptTabGroup) {
        promptTabLive.addEventListener('click', () => {
            currentPromptTab = 'live';
            promptTabLive.classList.add('active');
            promptTabSummary.classList.remove('active');
            promptTabGroup.classList.remove('active');
            if(promptDesc) promptDesc.textContent = "直播互动提示词。使用 {char}, {user}, {guest}, {msg} 等变量。";
            if(ytPromptInput) ytPromptInput.value = channelState.systemPrompt || defaultPrompt;
        });

        promptTabSummary.addEventListener('click', () => {
            currentPromptTab = 'summary';
            promptTabSummary.classList.add('active');
            promptTabLive.classList.remove('active');
            promptTabGroup.classList.remove('active');
            if(promptDesc) promptDesc.textContent = "直播总结提示词。要求返回 JSON。";
            if(ytPromptInput) ytPromptInput.value = channelState.summaryPrompt || defaultSummaryPrompt;
        });
        
        promptTabGroup.addEventListener('click', () => {
            currentPromptTab = 'group';
            promptTabGroup.classList.add('active');
            promptTabLive.classList.remove('active');
            promptTabSummary.classList.remove('active');
            if(promptDesc) promptDesc.textContent = "粉丝群聊提示词。包含 {live_summary_context}, {chat_history} 等变量。";
            if(ytPromptInput) ytPromptInput.value = channelState.groupChatPrompt || defaultGroupChatPrompt;
        });
    }

    const resetPromptBtn = document.getElementById('reset-yt-prompt-btn');
    if (resetPromptBtn) {
        resetPromptBtn.addEventListener('click', () => {
            if (!ytPromptInput) return;
            if (currentPromptTab === 'live') {
                ytPromptInput.value = defaultPrompt;
            } else if (currentPromptTab === 'summary') {
                ytPromptInput.value = defaultSummaryPrompt;
            } else {
                ytPromptInput.value = defaultGroupChatPrompt;
            }
        });
    }

    const confirmPromptBtn = document.getElementById('confirm-yt-prompt-btn');
    if (confirmPromptBtn) {
        confirmPromptBtn.addEventListener('click', () => {
            if (!ytPromptInput) return;
            if (currentPromptTab === 'live') {
                channelState.systemPrompt = ytPromptInput.value.trim();
            } else if (currentPromptTab === 'summary') {
                channelState.summaryPrompt = ytPromptInput.value.trim();
            } else {
                channelState.groupChatPrompt = ytPromptInput.value.trim();
            }
            saveYoutubeData();
            if(ytPromptSheet) ytPromptSheet.classList.remove('active');
            if(window.showToast) window.showToast('提示词已保存');
        });
    }

    // Summary List Logic
    const summaryListBtn = document.getElementById('yt-summary-list-btn');
    const summaryListSheet = document.getElementById('yt-summary-list-sheet');
    const summaryListContainer = document.getElementById('yt-summary-list-container');
    const summaryDetailSheet = document.getElementById('yt-summary-detail-sheet');
    const summaryDetailText = document.getElementById('yt-summary-detail-text');
    const summarySaveBtn = document.getElementById('yt-summary-save-btn');
    const summaryDeleteBtn = document.getElementById('yt-summary-delete-btn');
    
    let currentEditingSummaryIndex = -1;

    if (summaryListBtn && summaryListSheet) {
        summaryListBtn.addEventListener('click', () => {
            if(ytSettingsSheet) ytSettingsSheet.classList.remove('active');
            renderSummaryList();
            summaryListSheet.classList.add('active');
        });
        
        summaryListSheet.addEventListener('mousedown', (e) => {
            if(e.target === summaryListSheet) summaryListSheet.classList.remove('active');
        });
        
        if (summaryDetailSheet) {
            summaryDetailSheet.addEventListener('mousedown', (e) => {
                if(e.target === summaryDetailSheet) summaryDetailSheet.classList.remove('active');
            });
        }
    }

    if (summarySaveBtn) {
        summarySaveBtn.addEventListener('click', () => {
            if (currentEditingSummaryIndex > -1 && channelState.liveSummaries) {
                if (summaryDetailText) {
                    channelState.liveSummaries[currentEditingSummaryIndex].content = summaryDetailText.value;
                }
                channelState.liveSummaries[currentEditingSummaryIndex].isEdited = true;
                saveYoutubeData();
                if(window.showToast) window.showToast('总结已修改');
                renderSummaryList(); // Refresh list preview
                if(summaryDetailSheet) summaryDetailSheet.classList.remove('active');
            }
        });
    }

    if (summaryDeleteBtn) {
        summaryDeleteBtn.addEventListener('click', () => {
            if (currentEditingSummaryIndex > -1 && channelState.liveSummaries) {
                if(confirm('确定要删除这条总结吗？')) {
                    channelState.liveSummaries.splice(currentEditingSummaryIndex, 1);
                    saveYoutubeData();
                    if(window.showToast) window.showToast('总结已删除');
                    renderSummaryList();
                    if(summaryDetailSheet) summaryDetailSheet.classList.remove('active');
                }
            }
        });
    }

    function renderSummaryList() {
        if (!summaryListContainer) return;
        summaryListContainer.innerHTML = '';
        
        if (!channelState.liveSummaries || channelState.liveSummaries.length === 0) {
            summaryListContainer.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">暂无直播总结记录</div>`;
            return;
        }

        for (let i = channelState.liveSummaries.length - 1; i >= 0; i--) {
            const summary = channelState.liveSummaries[i];
            const card = document.createElement('div');
            card.className = 'yt-summary-card';
            
            const displayTitle = summary.title || '直播记录';
            const safeContent = summary.content ? String(summary.content) : '';
            const displayContent = summary.isEdited ? (safeContent.length > 60 ? safeContent.slice(0, 60) + '...' : safeContent) : (safeContent || '无内容');

            card.innerHTML = `
                <div class="yt-summary-date">${summary.date || '未知时间'}</div>
                <div class="yt-summary-title">${displayTitle}</div>
                <div class="yt-summary-preview">主要内容：${displayContent}</div>
            `;
            
            card.addEventListener('click', () => {
                currentEditingSummaryIndex = i;
                if (summaryDetailText) {
                    if (summary.isEdited) {
                        summaryDetailText.value = summary.content || '';
                    } else {
                        summaryDetailText.value = `【直播时间】\n${summary.date || ''}\n\n` +
                                                  `【直播主题】\n${summary.title || ''}\n\n` +
                                                  `【直播内容】\n${summary.content || ''}\n\n` +
                                                  `【互动亮点】\n${summary.interaction || ''}\n\n` +
                                                  `【直播氛围】\n${summary.atmosphere || ''}`;
                    }
                }
                if (summaryDetailSheet) summaryDetailSheet.classList.add('active');
            });
            
            summaryListContainer.appendChild(card);
        }
    }

    // --- Video Player Logic ---
    const playerView = document.getElementById('yt-video-player-view');
    const playerBackBtn = document.getElementById('yt-player-back-btn');
    const ytPlayerVideoArea = document.getElementById('yt-player-video-area');
    const ytPlayerThumbnail = document.getElementById('yt-player-thumbnail');
    const ytCharSpeechBubble = document.getElementById('yt-char-speech-bubble');
    
    let currentVideoData = null;
    let chatInterval = null;
    let tempVideoCover = null;
    let tempGuestData = null;

    const ytEditVideoSheet = document.getElementById('yt-edit-video-sheet');
    const ytEditVideoCoverBtn = document.getElementById('yt-edit-video-cover-btn');
    const ytEditVideoUpload = document.getElementById('yt-edit-video-upload');
    const ytEditVideoCoverImg = document.getElementById('yt-edit-video-cover-img');
    const ytEditVideoTitleInput = document.getElementById('yt-edit-video-title-input');
    const confirmYtVideoBtn = document.getElementById('confirm-yt-video-btn');
    const resetYtVideoBtn = document.getElementById('reset-yt-video-btn');

    // Guest Picker Elements
    const ytGuestPickerSheet = document.getElementById('yt-guest-picker-sheet');
    const ytGuestList = document.getElementById('yt-guest-list');
    const closeYtGuestPickerBtn = document.getElementById('close-yt-guest-picker-btn');
    const ytEditVideoGuestSelector = document.getElementById('yt-edit-video-guest-selector');
    const ytEditVideoGuestName = document.getElementById('yt-edit-video-guest-name');
    
    // User Live Guest Elements
    const ytUserLiveGuestSelector = document.getElementById('yt-user-live-guest-selector');
    const ytUserLiveGuestName = document.getElementById('yt-user-live-guest-name');
    let userLiveSelectedGuest = null;

    function renderGuestPicker(onSelect) {
        if (!ytGuestList) return;
        ytGuestList.innerHTML = '';

        // "No Guest" option
        const noneItem = document.createElement('div');
        noneItem.className = 'account-card';
        noneItem.innerHTML = `<div class="account-content"><div class="account-name">无联动嘉宾</div></div>`;
        noneItem.addEventListener('click', () => {
            onSelect(null);
            if(ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
        });
        ytGuestList.appendChild(noneItem);

        // Subscriptions as options
        mockSubscriptions.forEach(sub => {
            // Avoid selecting self
            if (currentSubChannelData && sub.id === currentSubChannelData.id) return;
            if (ytUserState && sub.name === ytUserState.name) return;

            const item = document.createElement('div');
            item.className = 'account-card';
            item.innerHTML = `
                <div class="account-content">
                    <div class="account-avatar"><img src="${sub.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>
                    <div class="account-info">
                        <div class="account-name">${sub.name}</div>
                        <div class="account-detail">${sub.subs || '0'} 订阅者</div>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => {
                onSelect(sub);
                if(ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
            });
            ytGuestList.appendChild(item);
        });
    }

    if (closeYtGuestPickerBtn && ytGuestPickerSheet) {
        closeYtGuestPickerBtn.addEventListener('click', () => ytGuestPickerSheet.classList.remove('active'));
        ytGuestPickerSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytGuestPickerSheet) ytGuestPickerSheet.classList.remove('active');
        });
    }

    if (ytEditVideoGuestSelector && ytGuestPickerSheet) {
        ytEditVideoGuestSelector.addEventListener('click', () => {
            renderGuestPicker((selectedSub) => {
                tempGuestData = selectedSub;
                if (ytEditVideoGuestName) {
                    ytEditVideoGuestName.textContent = selectedSub ? selectedSub.name : '无';
                }
            });
            ytGuestPickerSheet.classList.add('active');
        });
    }
    
    if (ytUserLiveGuestSelector && ytGuestPickerSheet) {
        ytUserLiveGuestSelector.addEventListener('click', () => {
            renderGuestPicker((selectedSub) => {
                userLiveSelectedGuest = selectedSub;
                if (ytUserLiveGuestName) {
                    ytUserLiveGuestName.textContent = selectedSub ? selectedSub.name : '无';
                }
            });
            ytGuestPickerSheet.classList.add('active');
        });
    }

    if (ytPlayerVideoArea && ytEditVideoSheet) {
        ytPlayerVideoArea.addEventListener('click', (e) => {
            if (e.target === ytPlayerVideoArea || e.target === ytPlayerThumbnail) {
                if(currentVideoData) {
                    ytEditVideoTitleInput.value = currentVideoData.title || '';
                    if (currentVideoData.thumbnail) {
                        ytEditVideoCoverImg.src = currentVideoData.thumbnail;
                        ytEditVideoCoverImg.style.display = 'block';
                    } else {
                        ytEditVideoCoverImg.style.display = 'none';
                    }

                    // Set temp guest data
                    tempGuestData = currentVideoData.guest || null;
                    if(ytEditVideoGuestName) {
                        ytEditVideoGuestName.textContent = tempGuestData ? tempGuestData.name : '无';
                    }

                    ytEditVideoSheet.classList.add('active');
                }
            }
        });

        if (ytEditVideoSheet) {
            ytEditVideoSheet.addEventListener('mousedown', (e) => {
                if (e.target === ytEditVideoSheet) ytEditVideoSheet.classList.remove('active');
            });
        }

        if (ytEditVideoCoverBtn && ytEditVideoUpload) {
            ytEditVideoCoverBtn.addEventListener('click', () => ytEditVideoUpload.click());
            ytEditVideoUpload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        ytEditVideoCoverImg.src = event.target.result;
                        ytEditVideoCoverImg.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }

        if (resetYtVideoBtn) {
            resetYtVideoBtn.addEventListener('click', () => {
                ytEditVideoCoverImg.src = '';
                ytEditVideoCoverImg.style.display = 'none';
                ytEditVideoTitleInput.value = currentVideoData._originalTitle || '无标题';
            });
        }

        if (confirmYtVideoBtn) {
            confirmYtVideoBtn.addEventListener('click', () => {
                if (!currentVideoData) return;
                
                const newTitle = ytEditVideoTitleInput.value.trim() || '无标题';
                const newCover = (ytEditVideoCoverImg.style.display === 'block' && ytEditVideoCoverImg.src) ? ytEditVideoCoverImg.src : 'https://picsum.photos/320/180';

                currentVideoData.title = newTitle;
                currentVideoData.thumbnail = newCover;
                currentVideoData.guest = tempGuestData;
                
                const titleEl = document.getElementById('yt-player-title');
                if(titleEl) titleEl.textContent = newTitle;
                if(ytPlayerThumbnail) ytPlayerThumbnail.src = newCover;

                const channel = currentVideoData.channelData;
                if (channel && channel.generatedContent) {
                    if (currentVideoData.isLive && channel.generatedContent.currentLive) {
                        channel.generatedContent.currentLive.title = newTitle;
                        channel.generatedContent.currentLive.thumbnail = newCover;
                        channel.generatedContent.currentLive.guest = tempGuestData;
                    } else if (!currentVideoData.isLive && channel.generatedContent.pastVideos) {
                        const originalTitle = currentVideoData._originalTitle;
                        const match = channel.generatedContent.pastVideos.find(v => v.title === originalTitle);
                        if (match) {
                            match.title = newTitle;
                            match.thumbnail = newCover;
                            match.guest = tempGuestData;
                        }
                    }
                }
                
                if (channel && channel.id === 'user_channel_id' && channelState.pastVideos) {
                    const originalTitle = currentVideoData._originalTitle;
                    const match = channelState.pastVideos.find(v => v.title === originalTitle);
                    if (match) {
                        match.title = newTitle;
                        match.thumbnail = newCover;
                        match.guest = tempGuestData;
                    }
                }
                
                const mv = mockVideos.find(v => v.title === currentVideoData._originalTitle);
                if (mv) {
                    mv.title = newTitle;
                    mv.thumbnail = newCover;
                    mv.guest = tempGuestData;
                }
                
                currentVideoData._originalTitle = newTitle; 

                saveYoutubeData();
                renderVideos();
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                if (activeTab) {
                    const target = activeTab.getAttribute('data-target');
                    if (target === 'live' || target === 'past') renderGeneratedContent(target);
                } else if (channel && channel.id === 'user_channel_id') {
                    const userPastTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
                    if(userPastTab) userPastTab.click();
                }
                
                ytEditVideoSheet.classList.remove('active');
                if (window.showToast) window.showToast('视频信息已更新');
            });
        }
    }

    if(playerBackBtn && playerView) {
        playerBackBtn.addEventListener('click', () => {
            playerView.classList.remove('active');
            if(chatInterval) clearInterval(chatInterval);
            if(ytCharSpeechBubble) ytCharSpeechBubble.style.display = 'none'; 
        });
    }

    function openVideoPlayer(video) {
        try {
            if(!playerView) return;
            currentVideoData = video;
            if(!currentVideoData._originalTitle) currentVideoData._originalTitle = video.title;
            const channel = video.channelData;

            if(!channel) return;

            let displayThumb = video.thumbnail;
            if (!video.isLive && channel.generatedContent && channel.generatedContent.pastVideos) {
                const savedMatch = channel.generatedContent.pastVideos.find(v => v.title === video.title);
                if (savedMatch && savedMatch.thumbnail) displayThumb = savedMatch.thumbnail;
            } else if (video.isLive && channel.generatedContent && channel.generatedContent.currentLive && channel.generatedContent.currentLive.thumbnail) {
                displayThumb = channel.generatedContent.currentLive.thumbnail;
            }
            
            if(ytPlayerThumbnail) ytPlayerThumbnail.src = displayThumb;
            currentVideoData.thumbnail = displayThumb; 

            const titleEl = document.getElementById('yt-player-title');
            if(titleEl) titleEl.textContent = video.title || '无标题';
            
            const viewsEl = document.getElementById('yt-player-views');
            if(viewsEl) viewsEl.textContent = video.views || '0';
            
            const avatarEl = document.getElementById('yt-player-avatar');
            if(avatarEl) avatarEl.src = channel.avatar || '';
            
            const channelNameEl = document.getElementById('yt-player-channel-name');
            if(channelNameEl) channelNameEl.textContent = channel.name || '未知频道';
            
            const channelSubsEl = document.getElementById('yt-player-channel-subs');
            if(channelSubsEl) channelSubsEl.textContent = channel.subs || '1.2万 订阅者';

            if(ytCharSpeechBubble) {
                ytCharSpeechBubble.style.display = 'none';
                ytCharSpeechBubble.textContent = '';
            }

            const liveBadge = document.getElementById('yt-player-live-badge');
            const chatTitle = document.getElementById('yt-player-chat-title');
            const chatContainer = document.getElementById('yt-player-chat-container');
            const giftBtn = document.getElementById('yt-gift-btn');
            const plusMenu = document.querySelector('.yt-player-menu-container');
            
            if(chatContainer) chatContainer.innerHTML = ''; 

            if (video.isLive) {
                if(liveBadge) liveBadge.style.display = 'block';
                if(chatTitle) chatTitle.textContent = '实时聊天';
                if(giftBtn) giftBtn.style.display = 'flex';
                if(plusMenu) plusMenu.style.display = 'flex';
                
                currentChatHistory = [];
                
                let bubblesToPlay = video.initialBubbles;
                if (!bubblesToPlay || !Array.isArray(bubblesToPlay) || bubblesToPlay.length === 0) {
                    bubblesToPlay = ["欢迎来到直播间！", "大家晚上好~"];
                }

                if (bubblesToPlay.length > 0) {
                    bubblesToPlay.forEach((bubbleText, index) => {
                        setTimeout(() => {
                            if(ytCharSpeechBubble) {
                                ytCharSpeechBubble.textContent = bubbleText;
                                ytCharSpeechBubble.style.display = 'block';
                            }
                            // 不显示在弹幕区
                            
                            if (index === bubblesToPlay.length - 1) {
                                setTimeout(() => {
                                    if(ytCharSpeechBubble) ytCharSpeechBubble.style.display = 'none';
                                }, 5000);
                            }
                        }, 500 + (index * 2000));
                    });
                }
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    video.comments.forEach(c => addChatMessage(c.name || '观众', c.text || ''));
                    
                    if(chatInterval) clearInterval(chatInterval);
                    chatInterval = setInterval(() => {
                        if (video.comments.length > 0) {
                            const randomComment = video.comments[Math.floor(Math.random() * video.comments.length)];
                            addChatMessage(randomComment.name || '观众', randomComment.text || '');
                        }
                    }, 3000);
                }
            } else {
                if(liveBadge) liveBadge.style.display = 'none';
                if(chatTitle) chatTitle.textContent = '评论';
                if(giftBtn) giftBtn.style.display = 'none';
                if(plusMenu) plusMenu.style.display = 'none';
                if(chatInterval) clearInterval(chatInterval);
                
                if(video.comments && Array.isArray(video.comments) && video.comments.length > 0) {
                    video.comments.forEach(c => addChatMessage(c.name || '观众', c.text || '', false));
                } else {
                    if(chatContainer) chatContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: #666;" id="yt-empty-comment-msg">暂无评论</div>`;
                }
            }

            playerView.classList.add('active');
        } catch (e) {
            console.error("Error opening video player:", e);
            if(window.showToast) window.showToast('打开视频出错');
        }
    }

    function addChatMessage(name, text, isLive = true, amount = null, color = null) {
        const chatContainer = document.getElementById('yt-player-chat-container');
        if(!chatContainer) return;

        const emptyMsg = document.getElementById('yt-empty-comment-msg');
        if(emptyMsg) emptyMsg.remove();

        const row = document.createElement('div');
        
        if (amount) {
            row.style.backgroundColor = color || '#1565c0';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${name} <span style="margin-left: 8px;">￥${amount}</span></div>
                <div style="font-size: 14px; color: #fff;">${text}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px'; // slightly more margin for VOD
            
            const randColor = '#' + Math.floor(Math.random()*16777215).toString(16);
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${name && name.length > 0 ? name[0].toUpperCase() : '?'}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span class="yt-chat-msg-name" style="font-size:12px; margin-right:4px;">${name}</span>
                    <span class="yt-chat-msg-text">${text}</span>
                </div>
            `;
        }
        
        // append to bottom for both live and VOD as requested (最新评论置底)
        chatContainer.appendChild(row);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        if(isLive) {
            currentChatHistory.push({
                time: new Date().toLocaleTimeString(),
                name: name || '未知',
                text: text || '',
                amount: amount
            });
            if (currentChatHistory.length > 50) currentChatHistory.shift(); 
        }
    }

    // --- VOD Comment API ---
    async function getVODResponse(userMessage, titleOverride) {
        if (!currentSubChannelData) return null;
        const char = currentSubChannelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            return { charReplies: ["（请配置API后体验互动）"], fanReplies: [] };
        }
        
        const userPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? (window.userState.persona || '普通观众') : '普通观众');
        let wbContext = '';
        if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
            const wbs = window.getWorldBooks();
            channelState.boundWorldBookIds.forEach(id => {
                const boundWb = wbs.find(w => w.id === id);
                if (boundWb && boundWb.entries) {
                    wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                }
            });
        }

        let promptStr = channelState.vodPrompt || defaultVODPrompt;
        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, char.desc || '未知')
            .replace(/{user}/g, window.userState ? window.userState.name : '我')
            .replace(/{user_persona}/g, userPersona)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{video_title}/g, titleOverride || (currentVideoData ? currentVideoData.title : '未知内容'));

        try {
            let endpoint = window.apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(resultText);
        } catch (error) {
            console.error('VOD API Error:', error);
            return {
                charReplies: ["（网络似乎断开了...）"],
                fanReplies: []
            };
        }
    }

    function renderVODResponse(responseObj, isPost = false) {
        if (!responseObj) return;
        
        const userName = window.userState ? window.userState.name : '用户';
        
        let replies = [];
        if (responseObj.charReplies && Array.isArray(responseObj.charReplies)) {
            replies = responseObj.charReplies;
        } else if (responseObj.charReply) {
            replies = [responseObj.charReply];
        }

        // Add char replies with prefix
        replies.forEach((text, index) => {
            setTimeout(() => {
                const replyText = `回复 @${userName} : ${text}`;
                if (isPost) {
                    addPostCommentMessage(currentSubChannelData.name, replyText);
                } else {
                    addChatMessage(currentSubChannelData.name, replyText, false); 
                }
            }, 1000 + (index * 1500));
        });

        // Add fan replies with prefix
        if (responseObj.fanReplies && Array.isArray(responseObj.fanReplies)) {
            responseObj.fanReplies.forEach((c, i) => {
                setTimeout(() => {
                    const replyText = `回复 @${userName} : ${c.text}`;
                    if (isPost) {
                        addPostCommentMessage(c.name || '观众', replyText);
                    } else {
                        addChatMessage(c.name || '观众', replyText, false);
                    }
                }, 1500 + (replies.length * 1500) + (i * 1500));
            });
        }
        
        // Remove loading indicator
        const loadingMsg = document.getElementById('yt-reply-loading');
        if (loadingMsg) loadingMsg.remove();
        
        const postLoadingMsg = document.getElementById('yt-post-reply-loading');
        if (postLoadingMsg) postLoadingMsg.remove();
    }

    // AI API call for interactive response (Live)
    async function getCharResponse(userMessage, isSC = false, amount = 0, isContinue = false) {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        const guest = currentVideoData.guest;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            return { charBubbles: ["（请配置API后体验互动）"], passerbyComments: [] };
        }
        
        if(ytCharSpeechBubble) {
            ytCharSpeechBubble.style.display = 'block';
            ytCharSpeechBubble.innerHTML = '<i class="fas fa-ellipsis-h fa-fade"></i>';
        }
        
        const userPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? (window.userState.persona || '普通观众') : '普通观众');
        let wbContext = '';
        if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
            const wbs = window.getWorldBooks();
            channelState.boundWorldBookIds.forEach(id => {
                const boundWb = wbs.find(w => w.id === id);
                if (boundWb && boundWb.entries) {
                    wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                }
            });
        }

        // Get last summary for live context
        let lastSummary = '暂无';
        if (channelState.liveSummaries && channelState.liveSummaries.length > 0) {
            const s = channelState.liveSummaries[channelState.liveSummaries.length - 1];
            lastSummary = `主题: ${s.title}, 内容: ${s.content}`;
        }

        let systemPromptStr = channelState.systemPrompt || defaultPrompt;

        let contextClueStr = isContinue 
            ? "注意：现在没有新的观众发言。请你作为主播，根据上下文自主推进直播内容，主动找话题，进行环境描写或动作描写，不要傻等观众，保持直播间的活跃氛围。" 
            : "";
            
        let msgContextStr = userMessage 
            ? `刚刚有一位观众发了一条弹幕说：“${userMessage}”。请主要针对这条留言进行回复。`
            : "";

        let guestContextStr = guest 
            ? `\n特别注意：本场直播的联动嘉宾是"${guest.name}"，ta的人设："${guest.desc || '未知'}"。你的回复中可以偶尔cue到嘉宾，或由你代为复述嘉宾说的话。`
            : "";

        let finalPrompt = systemPromptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, char.desc || '未知')
            .replace(/{user}/g, window.userState ? window.userState.name : '我')
            .replace(/{user_persona}/g, userPersona)
            .replace(/{guest}/g, guest ? guest.name : '无嘉宾')
            .replace(/{wb_context}/g, wbContext)
            .replace(/{live_summary_context}/g, lastSummary)
            .replace(/{msg}/g, userMessage || '')
            .replace(/{msg_context}/g, msgContextStr)
            .replace(/{context_clue}/g, contextClueStr + guestContextStr);
            
        if (isSC) {
            finalPrompt += `\n注意：这是一条价值 ${amount} 元的 Super Chat（醒目留言）！请表现出相应的感谢。`;
        }

        try {
            let endpoint = window.apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(resultText);
        } catch (error) {
            console.error('Interactive Live Error:', error);
            return {
                charBubbles: ["（直播信号有点差...）"],
                passerbyComments: []
            };
        }
    }

    function renderAiResponse(responseObj) {
        if (!responseObj) return;

        if (responseObj.randomSuperChat && responseObj.randomSuperChat.hasSuperChat) {
            setTimeout(() => {
                addChatMessage(
                    responseObj.randomSuperChat.name || '神秘人', 
                    responseObj.randomSuperChat.text || '', 
                    true, 
                    responseObj.randomSuperChat.amount || 30, 
                    responseObj.randomSuperChat.color || '#00bfa5'
                );
            }, 500);
        }

        let bubbles = [];
        if (responseObj.charBubbles && Array.isArray(responseObj.charBubbles)) {
            bubbles = responseObj.charBubbles;
        } else if (responseObj.charResponse) {
            bubbles = [responseObj.charResponse];
        }

        if (bubbles.length > 0) {
            bubbles.forEach((bubbleText, index) => {
                setTimeout(() => {
                    if(ytCharSpeechBubble) {
                        ytCharSpeechBubble.textContent = bubbleText;
                        ytCharSpeechBubble.style.display = 'block';
                    }
                    // 主播的话不再显示在下方评论区，仅在气泡显示
                    
                    if (index === bubbles.length - 1) {
                        setTimeout(() => {
                            if(ytCharSpeechBubble) ytCharSpeechBubble.style.display = 'none';
                        }, 5000);
                    }
                }, 1000 + (index * 2500)); 
            });
        } else {
            if(ytCharSpeechBubble) ytCharSpeechBubble.style.display = 'none';
        }

        if (responseObj.passerbyComments && Array.isArray(responseObj.passerbyComments)) {
            responseObj.passerbyComments.forEach((c, i) => {
                setTimeout(() => {
                    addChatMessage(c.name || '观众', c.text, true);
                }, 2000 + (i * 2000));
            });
        }
    }

    async function generateLiveSummary() {
        if (!currentVideoData || !currentVideoData.channelData) return null;
        const char = currentVideoData.channelData;
        
        if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
            if(window.showToast) window.showToast('请先配置 API 以生成总结');
            return null;
        }

        const userPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? window.userState.name : '用户');
        
        let historyStr = "";
        if (currentChatHistory.length > 0) {
            historyStr = currentChatHistory.map(item => {
                if(item.amount) return `[${item.time}] ${item.name} 打赏了 ${item.amount}元: ${item.text}`;
                return `[${item.time}] ${item.name}: ${item.text}`;
            }).join('\n');
        } else {
            historyStr = "（暂无详细聊天记录）";
        }

        let promptStr = channelState.summaryPrompt || defaultSummaryPrompt;
        
        if (!promptStr.includes('newSubs')) {
            promptStr += `\n\n请在JSON中额外返回一个 "newSubs" 字段（整数），代表本次直播带来的新增订阅数。`;
        }

        let finalPrompt = promptStr
            .replace(/{char}/g, char.name || '')
            .replace(/{char_persona}/g, char.desc || '未知')
            .replace(/{user}/g, userPersona)
            .replace(/{current_time}/g, new Date().toLocaleString())
            .replace(/{chat_history}/g, historyStr);

        try {
            let endpoint = window.apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.7,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const summaryObj = JSON.parse(resultText);
            
            if(!channelState.liveSummaries) channelState.liveSummaries = [];
            channelState.liveSummaries.push(summaryObj);
            
            // Update Char Subs
            if (summaryObj.newSubs && typeof summaryObj.newSubs === 'number') {
                const currentSubsNum = parseSubs(char.subs);
                char.subs = formatSubs(currentSubsNum + summaryObj.newSubs);
                
                const subIndex = mockSubscriptions.findIndex(s => s.id === char.id);
                if (subIndex > -1) {
                    mockSubscriptions[subIndex].subs = char.subs;
                }
                
                if (currentSubChannelData && currentSubChannelData.id === char.id) {
                    const subsEl = document.getElementById('sub-channel-subs');
                    if (subsEl) subsEl.textContent = `${char.subs} 订阅者`;
                }
            }
            
            saveYoutubeData();
            if(window.showToast) window.showToast('直播总结生成完毕并已保存');
            
            if(playerView) playerView.classList.remove('active');
            if(chatInterval) clearInterval(chatInterval);
            if(ytCharSpeechBubble) ytCharSpeechBubble.style.display = 'none';

        } catch (error) {
            console.error('Summary Error:', error);
            if(window.showToast) window.showToast('生成总结失败');
        }
    }


    const chatInput = document.getElementById('yt-player-chat-input');
    const chatSend = document.getElementById('yt-player-chat-send');
    
    const playerPlusBtn = document.getElementById('yt-player-plus-btn');
    const playerActionMenu = document.getElementById('yt-player-action-menu');
    const actionContinue = document.getElementById('yt-player-action-continue');
    const actionSummary = document.getElementById('yt-player-action-summary');

    if(chatSend && chatInput) {
        chatSend.addEventListener('click', async () => {
            const text = chatInput.value.trim();
            if(!text) return;
            
            const isLive = currentVideoData && currentVideoData.isLive;
            addChatMessage(window.userState ? window.userState.name : '我', text, isLive);
            chatInput.value = '';
            
            if (!currentVideoData) return;
            
            if (isLive) {
                const responseObj = await getCharResponse(text, false);
                renderAiResponse(responseObj);
            } else {
                // Show loading indicator
                const chatContainer = document.getElementById('yt-player-chat-container');
                if(chatContainer) {
                    const loadingId = 'yt-reply-loading';
                    const loadingDiv = document.createElement('div');
                    loadingDiv.id = loadingId;
                    loadingDiv.style.textAlign = 'center';
                    loadingDiv.style.padding = '10px';
                    loadingDiv.style.color = '#8e8e93';
                    loadingDiv.style.fontSize = '12px';
                    loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
                    chatContainer.appendChild(loadingDiv);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                const responseObj = await getVODResponse(text);
                renderVODResponse(responseObj);
            }
        });
        
        chatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') chatSend.click();
        });
    }

    if(playerPlusBtn && playerActionMenu) {
        playerPlusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            playerActionMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!playerPlusBtn.contains(e.target) && !playerActionMenu.contains(e.target)) {
                playerActionMenu.classList.remove('active');
            }
        });
    }

    if(actionContinue) {
        actionContinue.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成后续直播内容...');
                const responseObj = await getCharResponse('', false, 0, true); 
                renderAiResponse(responseObj);
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    if(actionSummary) {
        actionSummary.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(playerActionMenu) playerActionMenu.classList.remove('active');
            if(currentVideoData && currentVideoData.isLive) {
                if(window.showToast) window.showToast('正在生成并保存直播总结...');
                await generateLiveSummary();
            } else {
                if(window.showToast) window.showToast('仅在直播时可用');
            }
        });
    }

    // --- Super Chat Logic ---
    const ytGiftBtn = document.getElementById('yt-gift-btn');
    const ytScSheet = document.getElementById('yt-sc-sheet');
    const scAmountBtns = document.querySelectorAll('.sc-amount-btn');
    const ytScCustomInput = document.getElementById('yt-sc-custom-amount');
    const ytScInput = document.getElementById('yt-sc-input');
    const ytSendScBtn = document.getElementById('yt-send-sc-btn');
    
    let currentScAmount = 30;
    let currentScColor = '#1565c0';

    if(ytGiftBtn && ytScSheet) {
        ytGiftBtn.addEventListener('click', () => {
            ytScSheet.classList.add('active');
        });

        ytScSheet.addEventListener('mousedown', (e) => {
            if (e.target === ytScSheet) {
                ytScSheet.classList.remove('active');
            }
        });
    }

    function updateScBtn() {
        if(ytSendScBtn) {
            ytSendScBtn.textContent = `发送 ￥${currentScAmount}`;
            ytSendScBtn.style.backgroundColor = currentScColor;
        }
    }

    scAmountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scAmountBtns.forEach(b => {
                b.classList.remove('selected');
                b.style.background = '#f2f2f2';
                b.style.color = '#333';
            });
            btn.classList.add('selected');
            currentScAmount = btn.getAttribute('data-amount');
            currentScColor = btn.getAttribute('data-color');
            
            btn.style.background = currentScColor;
            btn.style.color = 'white';
            if(ytScCustomInput) ytScCustomInput.value = '';
            updateScBtn();
        });
    });

    if(ytScCustomInput) {
        ytScCustomInput.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val && !isNaN(val)) {
                currentScAmount = val;
                currentScColor = '#e65100'; 
                scAmountBtns.forEach(b => {
                    b.classList.remove('selected');
                    b.style.background = '#f2f2f2';
                    b.style.color = '#333';
                });
                updateScBtn();
            }
        });
    }

    if(ytSendScBtn) {
        ytSendScBtn.addEventListener('click', async () => {
            const text = ytScInput ? ytScInput.value.trim() || '支持主播！' : '支持主播！';
            
            addChatMessage(window.userState ? window.userState.name : '我', text, true, currentScAmount, currentScColor);
            
            if(ytScInput) ytScInput.value = '';
            if(ytScSheet) ytScSheet.classList.remove('active');
            
            if(currentVideoData && currentVideoData.isLive) {
                const responseObj = await getCharResponse(text, true, currentScAmount);
                renderAiResponse(responseObj);
            }
        });
    }

    // --- Content Generation Logic (Append Mode) ---
    const btnGenerate = document.getElementById('yt-char-generate-btn');
    const loadingEl = document.getElementById('sub-channel-loading');

    function renderGeneratedContent(type) {
        try {
            if (!subChannelContent) return;
            if (!currentSubChannelData || !currentSubChannelData.generatedContent) {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">点击右上角魔法棒生成内容</div>`;
                return;
            }

            const data = currentSubChannelData.generatedContent;
            subChannelContent.innerHTML = '';

            if (type === 'live' && data.currentLive) {
                const el = document.createElement('div');
                const thumbUrl = data.currentLive.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180`;
                
                el.innerHTML = `
                    <div class="yt-video-card yt-live-pin-card" style="margin: 0 16px;">
                        <div class="yt-video-thumbnail">
                            <img src="${thumbUrl}" alt="Live">
                            <div class="yt-live-badge"><i class="fas fa-broadcast-tower" style="font-size: 10px;"></i> LIVE</div>
                        </div>
                        <div class="yt-video-info" style="padding: 12px;">
                            <div class="yt-video-details">
                                <h3 class="yt-video-title">${data.currentLive.title || '无标题'}</h3>
                                <p class="yt-video-meta">${data.currentLive.views || '1.2万 人正在观看'}</p>
                            </div>
                        </div>
                    </div>
                `;
                
                const cardEl = el.querySelector('.yt-video-card');
                if (cardEl) {
                    cardEl.addEventListener('click', () => {
                        const videoObj = {
                            title: data.currentLive.title,
                            views: data.currentLive.views,
                            thumbnail: thumbUrl,
                            isLive: true,
                            channelData: currentSubChannelData,
                            comments: data.currentLive.comments || [],
                            initialBubbles: data.currentLive.initialBubbles || [],
                            guest: data.currentLive.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                }
                
                subChannelContent.appendChild(el);
            } else if (type === 'past' && data.pastVideos && data.pastVideos.length > 0) {
                const listWrapper = document.createElement('div');
                listWrapper.className = 'yt-history-list';
                listWrapper.style.padding = '0 16px';
                
                data.pastVideos.forEach((v, index) => {
                    const item = document.createElement('div');
                    item.className = 'yt-history-item';
                    item.style.position = 'relative';
                    const thumbUrl = v.thumbnail || `https://picsum.photos/seed/${Math.random()}/320/180`;
                    item.innerHTML = `
                        <div class="yt-history-thumb">
                            <img src="${thumbUrl}" alt="VOD">
                            <div class="yt-history-time">${Math.floor(Math.random() * 2)+1}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}</div>
                        </div>
                        <div class="yt-history-info">
                            <h3 class="yt-history-title">${v.title || '无标题'}</h3>
                            <p class="yt-history-meta">${v.views || Math.floor(Math.random() * 50) + 1 + '万次观看'} • ${v.time || Math.floor(Math.random() * 11) + 1 + '个月前'}</p>
                        </div>
                        <div class="yt-history-delete-btn" style="position: absolute; right: 10px; top: 10px; background: rgba(0,0,0,0.5); width: 28px; height: 28px; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: #fff; cursor: pointer; z-index: 10;">
                            <i class="fas fa-trash-alt" style="font-size: 12px;"></i>
                        </div>
                    `;
                    
                    item.addEventListener('click', (e) => {
                        if (e.target.closest('.yt-history-delete-btn')) {
                            e.stopPropagation();
                            window.showCustomModal({
                                title: '删除视频',
                                message: '确定要删除这个往期视频吗？',
                                confirmText: '删除',
                                cancelText: '取消',
                                isDestructive: true,
                                onConfirm: () => {
                                    data.pastVideos.splice(index, 1);
                                    saveYoutubeData();
                                    renderGeneratedContent('past');
                                    if(window.showToast) window.showToast('视频已删除');
                                }
                            });
                            return;
                        }
                        const videoObj = {
                            title: v.title,
                            views: v.views,
                            thumbnail: item.querySelector('img').src,
                            isLive: false,
                            channelData: currentSubChannelData,
                            comments: v.comments || [],
                            guest: v.guest || null
                        };
                        openVideoPlayer(videoObj);
                    });
                    
                    listWrapper.appendChild(item);
                });
                subChannelContent.appendChild(listWrapper);
            } else if (type === 'community' && data.communityPosts) {
                if (data.fanGroup) {
                    const isJoined = data.fanGroup.isJoined || false;
                    const btnBg = isJoined ? '#e5e5e5' : '#000';
                    const btnColor = isJoined ? '#606060' : '#fff';
                    const btnText = isJoined ? '进入' : '加入';

                    const groupEl = document.createElement('div');
                    groupEl.style.margin = '0 16px 16px';
                    groupEl.style.padding = '12px';
                    groupEl.style.backgroundColor = '#f2f2f2';
                    groupEl.style.borderRadius = '12px';
                    groupEl.style.display = 'flex';
                    groupEl.style.alignItems = 'center';
                    groupEl.style.gap = '10px';
                    groupEl.style.cursor = 'pointer';
                    
                    let groupAvatarHtml = `
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #ffcc00; display: flex; justify-content: center; align-items: center; color: white;">
                            <i class="fas fa-users"></i>
                        </div>
                    `;
                    
                    if (data.fanGroup.avatar) {
                        groupAvatarHtml = `
                            <div style="width: 40px; height: 40px; border-radius: 50%; overflow: hidden;">
                                <img src="${data.fanGroup.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `;
                    }

                    groupEl.innerHTML = `
                        ${groupAvatarHtml}
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 14px;">${data.fanGroup.name || '粉丝群'}</div>
                            <div style="font-size: 12px; color: #606060;">${data.fanGroup.memberCount || '3000人'} • 粉丝专属基地</div>
                        </div>
                        <div class="yt-fan-group-btn" style="background: ${btnBg}; color: ${btnColor}; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; transition: all 0.2s;">${btnText}</div>
                    `;
                    
                    groupEl.addEventListener('click', () => {
                        if (!data.fanGroup.isJoined) {
                            data.fanGroup.isJoined = true;
                            renderGeneratedContent('community'); 
                            saveYoutubeData();
                            if(window.showToast) window.showToast('已加入粉丝群！');
                        }
                        openFanGroupChat(data.fanGroup);
                    });
                    
                    subChannelContent.appendChild(groupEl);
                }

                if(Array.isArray(data.communityPosts)){
                    data.communityPosts.forEach(post => {
                        const el = document.createElement('div');
                        el.className = 'yt-community-post';
                        el.style.cursor = 'pointer';
                        el.innerHTML = `
                            <div style="display: flex; align-items: center; margin-bottom: 10px; gap: 10px;">
                                <div class="yt-video-avatar" style="width:36px; height:36px;"><img src="${currentSubChannelData.avatar || ''}"></div>
                                <div style="flex:1;">
                                    <div style="font-size:14px; font-weight:500;">${currentSubChannelData.name || '未知'}</div>
                                    <div style="font-size:11px; color:#606060;">${post.time || '刚刚'}</div>
                                </div>
                            </div>
                            <div class="yt-community-post-content">${post.content || ''}</div>
                            <div class="yt-community-post-actions">
                                <div class="yt-community-post-action"><i class="far fa-thumbs-up"></i> ${post.likes || '1.2万'}</div>
                                <div class="yt-community-post-action"><i class="far fa-thumbs-down"></i></div>
                                <div class="yt-community-post-action"><i class="far fa-comment"></i> ${post.commentsCount || post.comments?.length || '856'}</div>
                            </div>
                        `;
                        
                        el.addEventListener('click', () => {
                            openPostDetail(post);
                        });
                        
                        subChannelContent.appendChild(el);
                    });
                }
            } else {
                subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#8e8e93; font-size:14px;">暂无相关内容</div>`;
            }
        } catch (e) {
            console.error("Error rendering content:", e);
        }
    }

    if (btnGenerate) {
        btnGenerate.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!currentSubChannelData) return;
            
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先在设置中配置大模型 API');
                return;
            }

            if(subChannelContent) subChannelContent.innerHTML = '';
            if (loadingEl) loadingEl.style.display = 'block';
            
            const prompt = `你是一个YouTube内容生成助手。现在有一个YouTuber，她的频道名称是："${currentSubChannelData.name}"，她的人设和简介是："${currentSubChannelData.desc || '未知'}"。
请你根据她的设定，生成符合她人设风格的内容，返回严格的JSON格式数据。
要求JSON包含以下字段：
1. currentLive: 对象，包含:
   - title(直播标题) 
   - views(观看人数，如"1.5万 人正在观看")
   - initialBubbles: 字符串数组，模拟刚进入直播间时主播正在说的话（1-2句开场白或正在进行的话题）。
   - comments: 数组，包含5-10个对象，每个对象有 name(观众昵称) 和 text(弹幕内容，要符合直播氛围)。
2. pastVideos: 数组，包含3个对象，每个对象有:
   - title(往期视频标题)
   - views(观看次数，如"45万次观看")
   - time(发布时间，如"2天前")
   - comments: 数组，包含3-5个对象，每个对象有 name(观众昵称) 和 text(评论内容)。
3. communityPosts: 数组，包含1-3个对象，每个对象代表一条YouTube社区动态，有:
   - content(动态正文内容，符合人设口吻)
   - likes(点赞数字符串，如"3.2万")
   - commentsCount(评论数，如"1400")
   - time(发布时间，如"5小时前")
   - comments: 数组，包含3-5个对象，代表这条动态下的热门评论，每个对象有 name(观众昵称) 和 text(评论内容)。
4. fanGroup: 对象，包含 name(粉丝群名称，如"xx的秘密基地") 和 memberCount(群人数，如"3000人")。
注意：只能返回纯 JSON，不要包含 Markdown 符号如 \`\`\`json。`;

            try {
                let endpoint = window.apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error(`API Error: ${res.status}`);
                
                const data = await res.json();
                let resultText = data.choices[0].message.content;
                resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedData = JSON.parse(resultText);

                // --- Append Logic instead of replace ---
                if (!currentSubChannelData.generatedContent) {
                    currentSubChannelData.generatedContent = { pastVideos: [], communityPosts: [] };
                }
                const oldGen = currentSubChannelData.generatedContent;
                
                // If there's an active live, move it to past
                if (oldGen.currentLive) {
                    if (!oldGen.pastVideos) oldGen.pastVideos = [];
                    oldGen.pastVideos.unshift({
                        title: oldGen.currentLive.title,
                        views: oldGen.currentLive.views,
                        time: '刚刚直播结束',
                        thumbnail: oldGen.currentLive.thumbnail,
                        comments: oldGen.currentLive.comments,
                        guest: oldGen.currentLive.guest || null
                    });
                }
                
                oldGen.currentLive = parsedData.currentLive;
                
                if (parsedData.pastVideos) {
                    if (!oldGen.pastVideos) oldGen.pastVideos = [];
                    oldGen.pastVideos = parsedData.pastVideos.concat(oldGen.pastVideos);
                }
                
                if (parsedData.communityPosts) {
                    if (!oldGen.communityPosts) oldGen.communityPosts = [];
                    oldGen.communityPosts = parsedData.communityPosts.concat(oldGen.communityPosts);
                }
                
                if (parsedData.fanGroup) {
                    if (oldGen.fanGroup) {
                        parsedData.fanGroup.isJoined = oldGen.fanGroup.isJoined; 
                        // Preserve name if exists
                        if (oldGen.fanGroup.name) {
                            parsedData.fanGroup.name = oldGen.fanGroup.name;
                        }
                    }
                    oldGen.fanGroup = parsedData.fanGroup;
                }
                
                saveYoutubeData();
                
                if(parsedData.currentLive) {
                    const newLiveVideo = {
                        title: parsedData.currentLive.title,
                        views: parsedData.currentLive.views,
                        time: 'LIVE',
                        thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180',
                        isLive: true,
                        comments: parsedData.currentLive.comments,
                        initialBubbles: parsedData.currentLive.initialBubbles || [], 
                        guest: parsedData.currentLive.guest || null,
                        channelData: currentSubChannelData 
                    };
                    
                    mockVideos = mockVideos.filter(v => v.channelData.id !== currentSubChannelData.id);
                    mockVideos.unshift(newLiveVideo);
                    renderVideos();
                }

                if (loadingEl) loadingEl.style.display = 'none';
                
                const activeTab = document.querySelector('#sub-channel-tabs .yt-sliding-tab.active');
                const target = activeTab ? activeTab.getAttribute('data-target') : 'live';
                renderGeneratedContent(target);

                if(window.showToast) window.showToast('内容生成成功并已保存！');

            } catch (error) {
                console.error(error);
                if (loadingEl) loadingEl.style.display = 'none';
                if(subChannelContent) subChannelContent.innerHTML = `<div style="text-align:center; padding: 30px; color:#ff3b30; font-size:14px;">生成失败，请检查 API 配置或网络</div>`;
            }
        });
    }


    // --- Community Detail View Logic ---
    const communityDetailView = document.getElementById('yt-community-detail-view');
    const communityDetailBackBtn = document.getElementById('yt-community-detail-back-btn');
    const communityDetailContent = document.getElementById('yt-community-detail-content');
    const postChatSend = document.getElementById('yt-community-chat-send');
    const postChatInput = document.getElementById('yt-community-chat-input');
    
    let currentActivePost = null;

    if (communityDetailBackBtn) {
        communityDetailBackBtn.addEventListener('click', () => {
            if (communityDetailView) communityDetailView.classList.remove('active');
        });
    }

    function openPostDetail(post) {
        if (!communityDetailView || !communityDetailContent || !currentSubChannelData) return;
        currentActivePost = post;

        // Initialize user avatar in input area
        const userAvatar = document.getElementById('yt-community-user-avatar');
        const userIcon = document.getElementById('yt-community-user-icon');
        if (window.userState && window.userState.avatarUrl && userAvatar) {
            userAvatar.src = window.userState.avatarUrl;
            userAvatar.style.display = 'block';
            if(userIcon) userIcon.style.display = 'none';
        }

        renderPostComments();
        communityDetailView.classList.add('active');
    }

    function renderPostComments() {
        if (!currentActivePost) return;
        const post = currentActivePost;
        
        let commentsHtml = '';
        if (post.comments && Array.isArray(post.comments) && post.comments.length > 0) {
            commentsHtml = post.comments.map(c => `
                <div class="yt-community-comment-item">
                    <div class="yt-video-avatar" style="width:30px; height:30px; flex-shrink: 0; background-color: #f2f2f2; display: flex; justify-content: center; align-items: center; border-radius: 50%; overflow: hidden;">
                        ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:12px; font-weight:bold; color:#555;">${c.name ? c.name[0].toUpperCase() : '?'}</span>`}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 13px; color: #606060; margin-bottom: 4px;">${c.name}</div>
                        <div style="font-size: 14px; color: #0f0f0f; line-height: 1.4;">${c.text}</div>
                        <div style="font-size: 12px; color: #8e8e93; margin-top: 6px; display: flex; gap: 16px;">
                            <span><i class="far fa-thumbs-up"></i> ${Math.floor(Math.random() * 500) + 10}</span>
                            <span><i class="far fa-thumbs-down"></i></span>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            commentsHtml = '<div style="text-align:center; padding: 20px; color:#8e8e93; font-size:13px;" id="yt-empty-post-comments">暂无评论</div>';
        }

        communityDetailContent.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 12px; gap: 10px;">
                <div class="yt-video-avatar" style="width:40px; height:40px;"><img src="${currentSubChannelData.avatar || ''}"></div>
                <div style="flex:1;">
                    <div style="font-size:15px; font-weight:500;">${currentSubChannelData.name || '未知'}</div>
                    <div style="font-size:12px; color:#606060;">${post.time || '刚刚'}</div>
                </div>
            </div>
            <div style="font-size: 15px; line-height: 1.5; color: #0f0f0f; margin-bottom: 16px;">
                ${post.content || ''}
            </div>
            <div style="display: flex; gap: 24px; color: #606060; font-size: 14px; padding-bottom: 16px;">
                <span><i class="far fa-thumbs-up"></i> ${post.likes || '1.2万'}</span>
                <span><i class="far fa-thumbs-down"></i></span>
                <span><i class="far fa-comment"></i> ${post.comments?.length || post.commentsCount || '0'}</span>
            </div>

            <div class="yt-community-comments-section" id="yt-post-comments-container">
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 16px;">评论</div>
                ${commentsHtml}
            </div>
        `;
    }

    function addPostCommentMessage(name, text, isUser = false) {
        const container = document.getElementById('yt-post-comments-container');
        if (!container) return;
        
        const emptyMsg = document.getElementById('yt-empty-post-comments');
        if (emptyMsg) emptyMsg.remove();

        // Update state
        if (!currentActivePost.comments) currentActivePost.comments = [];
        
        const newComment = {
            name: name,
            text: text,
            avatar: isUser ? window.userState?.avatarUrl : null
        };
        
        // Append to array so it's at the end (newest at bottom)
        currentActivePost.comments.push(newComment);
        saveYoutubeData();

        // Re-render
        renderPostComments();
    }

    if (postChatSend && postChatInput) {
        postChatSend.addEventListener('click', async () => {
            const text = postChatInput.value.trim();
            if(!text) return;
            
            addPostCommentMessage(window.userState ? window.userState.name : '我', text, true);
            postChatInput.value = '';
            
            // Show loading
            const container = document.getElementById('yt-post-comments-container');
            let loadingId = null;
            if(container) {
                loadingId = 'yt-post-reply-loading';
                const loadingDiv = document.createElement('div');
                loadingDiv.id = loadingId;
                loadingDiv.style.textAlign = 'center';
                loadingDiv.style.padding = '10px';
                loadingDiv.style.color = '#8e8e93';
                loadingDiv.style.fontSize = '12px';
                loadingDiv.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> 回复生成中...';
                container.appendChild(loadingDiv);
            }

            const responseObj = await getVODResponse(text, currentActivePost.content);
            if(loadingId) { const el = document.getElementById(loadingId); if(el) el.remove(); }
            renderVODResponse(responseObj, true);
        });
        postChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') postChatSend.click();
        });
    }

    // --- Fan Group Chat Logic ---
    const groupChatView = document.getElementById('yt-bubble-chat-view');
    const groupChatBackBtn = document.getElementById('yt-bubble-chat-back-btn');
    const groupChatTitle = document.getElementById('yt-bubble-chat-title');
    const groupChatContainer = document.getElementById('yt-bubble-chat-container');
    const groupChatInput = document.getElementById('yt-bubble-chat-input');
    const groupChatSendBtn = document.getElementById('yt-bubble-chat-send-btn');
    const groupChatSettingsBtn = document.getElementById('yt-bubble-chat-settings-btn');
    
    // Settings Sheet Elements
    const groupSettingsSheet = document.getElementById('yt-group-settings-sheet');
    const groupNameInput = document.getElementById('yt-group-name-input');
    const groupOwnerInfo = document.getElementById('yt-group-owner-info');
    const groupSettingsSaveBtn = document.getElementById('yt-save-group-settings-btn');
    
    let isGroupChatLoading = false;

    if (groupChatBackBtn) {
        groupChatBackBtn.addEventListener('click', () => {
            if (groupChatView) groupChatView.classList.remove('active');
        });
    }
    
    // Group Settings Logic
    const groupAvatarWrapper = document.getElementById('yt-group-avatar-wrapper');
    const groupAvatarUpload = document.getElementById('yt-group-avatar-upload');
    const groupAvatarImg = document.getElementById('yt-group-avatar-img');
    const groupAvatarIcon = document.getElementById('yt-group-avatar-icon');
    const clearGroupHistoryBtn = document.getElementById('yt-clear-group-history-btn');
    const exitGroupBtn = document.getElementById('yt-exit-group-btn');

    if (groupAvatarWrapper && groupAvatarUpload) {
        groupAvatarWrapper.addEventListener('click', () => groupAvatarUpload.click());
        groupAvatarUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (groupAvatarImg) {
                        groupAvatarImg.src = event.target.result;
                        groupAvatarImg.style.display = 'block';
                    }
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (groupSettingsSheet) {
        groupSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === groupSettingsSheet) groupSettingsSheet.classList.remove('active');
        });
    }
    
    if (groupSettingsSaveBtn) {
        groupSettingsSaveBtn.addEventListener('click', () => {
            if (!currentSubChannelData || !currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
            
            if (groupNameInput && groupNameInput.value.trim()) {
                currentSubChannelData.generatedContent.fanGroup.name = groupNameInput.value.trim();
                if (groupChatTitle) groupChatTitle.textContent = `${groupNameInput.value.trim()} (${currentSubChannelData.generatedContent.fanGroup.memberCount})`;
            }

            if (groupAvatarImg && groupAvatarImg.style.display === 'block' && groupAvatarImg.src) {
                currentSubChannelData.generatedContent.fanGroup.avatar = groupAvatarImg.src;
            }
            
            saveYoutubeData();
            renderGeneratedContent('community'); // Refresh external card
            renderMessagesList(); // Refresh message list tab
            if(window.showToast) window.showToast('群设置已修改');
            groupSettingsSheet.classList.remove('active');
        });
    }

    if (clearGroupHistoryBtn) {
        clearGroupHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空该群聊的所有历史记录吗？此操作无法撤销。',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        renderGroupChatHistory(false);
                        if(window.showToast) window.showToast('聊天记录已清空');
                    }
                    groupSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (exitGroupBtn) {
        exitGroupBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '退出群聊',
                message: '确定要退出该粉丝群吗？退出后聊天记录将被删除。',
                confirmText: '退出',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData && currentSubChannelData.generatedContent && currentSubChannelData.generatedContent.fanGroup) {
                        currentSubChannelData.generatedContent.fanGroup.isJoined = false;
                        currentSubChannelData.groupChatHistory = [];
                        saveYoutubeData();
                        
                        groupSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderGeneratedContent('community');
                        renderMessagesList();
                        
                        if(window.showToast) window.showToast('已退出群聊');
                    }
                }
            });
        });
    }
    
    // Add Friend to DM Logic
    if (groupOwnerInfo) {
        groupOwnerInfo.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            
            window.showCustomModal({
                title: '添加私信',
                message: `是否将群主 ${currentSubChannelData.name} 添加至私信列表？`,
                confirmText: '添加',
                cancelText: '取消',
                onConfirm: () => {
                    if (!currentSubChannelData.dmHistory) {
                        currentSubChannelData.dmHistory = [];
                    }
                    
                    currentSubChannelData.isFriend = true; // Ensure it shows in DM list
                    if (currentSubChannelData.isBusiness === undefined) {
                        currentSubChannelData.isBusiness = false; // Default to non-business
                    }
                    
                    // Add an initial greeting if empty
                    if (currentSubChannelData.dmHistory.length === 0) {
                        currentSubChannelData.dmHistory.push({
                            type: 'char',
                            name: currentSubChannelData.name,
                            text: '我已经通过了你的好友请求，现在我们可以开始聊天了。'
                        });
                    }
                    
                    saveYoutubeData();
                    renderMessagesList();
                    
                    groupSettingsSheet.classList.remove('active');
                    if (groupChatView) groupChatView.classList.remove('active');
                    
                    // Optionally jump to DM view immediately
                    setTimeout(() => {
                        const msgNavBtn = document.querySelector('.yt-nav-item[data-target="yt-messages-tab"]');
                        if (msgNavBtn) msgNavBtn.click();
                        const msgFilterDm = document.getElementById('msg-filter-dm');
                        if (msgFilterDm) msgFilterDm.click();
                        if (window.showToast) window.showToast(`已添加与 ${currentSubChannelData.name} 的私信`);
                    }, 300);
                }
            });
        });
    }

    const dmSettingsSheet = document.getElementById('yt-dm-settings-sheet');
    const dmGoHomeBtn = document.getElementById('yt-dm-go-home-btn');
    const dmClearHistoryBtn = document.getElementById('yt-dm-clear-history-btn');
    const dmDeleteFriendBtn = document.getElementById('yt-dm-delete-friend-btn');
    
    // Add "Add Friend" logic
    let dmAddFriendBtn = document.getElementById('yt-dm-add-friend-btn');
    if (!dmAddFriendBtn && dmSettingsSheet) {
        dmAddFriendBtn = document.createElement('div');
        dmAddFriendBtn.className = 'sheet-action';
        dmAddFriendBtn.id = 'yt-dm-add-friend-btn';
        dmAddFriendBtn.style.color = '#007aff';
        dmAddFriendBtn.style.marginBottom = '10px';
        dmAddFriendBtn.textContent = '添加好友';
        
        // Insert before clear history
        if (dmClearHistoryBtn) {
            dmClearHistoryBtn.parentNode.insertBefore(dmAddFriendBtn, dmClearHistoryBtn);
        }
        
        dmAddFriendBtn.addEventListener('click', () => {
            if (currentSubChannelData && !currentSubChannelData.isFriend) {
                currentSubChannelData.isFriend = true;
                saveYoutubeData();
                if (window.showToast) window.showToast('已添加为好友');
                if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                renderMessagesList();
            }
        });
    }

    if (groupChatSettingsBtn) {
        groupChatSettingsBtn.addEventListener('click', () => {
            if (!currentSubChannelData) return;
            
            const isDM = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            
            if (isDM) {
                if (dmAddFriendBtn) {
                    if (currentSubChannelData.isFriend) {
                        dmAddFriendBtn.style.display = 'none';
                        dmDeleteFriendBtn.style.display = 'block';
                    } else {
                        dmAddFriendBtn.style.display = 'block';
                        dmDeleteFriendBtn.style.display = 'none';
                    }
                }
                if (dmSettingsSheet) dmSettingsSheet.classList.add('active');
            } else {
                // Group Settings
                if (!currentSubChannelData.generatedContent || !currentSubChannelData.generatedContent.fanGroup) return;
                const fanGroup = currentSubChannelData.generatedContent.fanGroup;
                
                if (groupNameInput) groupNameInput.value = fanGroup.name || '';
                
                // Set Group Avatar
                if (fanGroup.avatar && groupAvatarImg) {
                    groupAvatarImg.src = fanGroup.avatar;
                    groupAvatarImg.style.display = 'block';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'none';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = 'transparent';
                } else {
                    if (groupAvatarImg) groupAvatarImg.style.display = 'none';
                    if (groupAvatarIcon) groupAvatarIcon.style.display = 'block';
                    if (groupAvatarWrapper) groupAvatarWrapper.style.backgroundColor = '#ffcc00';
                }

                // Set Owner Info
                const ownerName = document.getElementById('yt-group-owner-name');
                const ownerAvatar = document.getElementById('yt-group-owner-avatar');
                if(ownerName) ownerName.textContent = currentSubChannelData.name;
                if(ownerAvatar) ownerAvatar.src = currentSubChannelData.avatar;
                
                if (groupSettingsSheet) groupSettingsSheet.classList.add('active');
            }
        });
    }
    
    if (dmSettingsSheet) {
        dmSettingsSheet.addEventListener('mousedown', (e) => {
            if (e.target === dmSettingsSheet) dmSettingsSheet.classList.remove('active');
        });
    }

    if (dmGoHomeBtn) {
        dmGoHomeBtn.addEventListener('click', () => {
            if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
            if (groupChatView) groupChatView.classList.remove('active');
            
            if (currentSubChannelData) {
                // Navigate to channel view
                const homeNavBtn = document.querySelector('.yt-nav-item[data-target="yt-home-tab"]');
                if (homeNavBtn) homeNavBtn.click();
                openSubChannelView(currentSubChannelData);
            }
        });
    }

    if (dmClearHistoryBtn) {
        dmClearHistoryBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '清空聊天记录',
                message: '确定要清空与该联系人的私信记录吗？',
                confirmText: '清空',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        
                        // 仅清空数据，不删除联系人卡片，即使不是好友也不删除
                        renderGroupChatHistory(true);
                        renderMessagesList();
                        
                        saveYoutubeData();
                        if(window.showToast) window.showToast('私信记录已清空');
                    }
                    if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                }
            });
        });
    }

    if (dmDeleteFriendBtn) {
        dmDeleteFriendBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '删除好友',
                message: '确定要删除该好友吗？私信记录将被清空。',
                confirmText: '删除',
                cancelText: '取消',
                isDestructive: true,
                onConfirm: () => {
                    if (currentSubChannelData) {
                        currentSubChannelData.dmHistory = [];
                        saveYoutubeData();
                        
                        if (dmSettingsSheet) dmSettingsSheet.classList.remove('active');
                        if (groupChatView) groupChatView.classList.remove('active');
                        
                        renderMessagesList();
                        if(window.showToast) window.showToast('已删除好友');
                    }
                }
            });
        });
    }

    function openFanGroupChat(groupData) {
        if (!groupChatView || !currentSubChannelData) return;
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${groupData.name} (${groupData.memberCount || '3000'})`;
        }

        renderGroupChatHistory(false);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function openDMChat(subData) {
        if (!groupChatView || !currentSubChannelData) return;
        
        if (groupChatTitle) {
            groupChatTitle.textContent = `${subData.name}`;
        }

        renderGroupChatHistory(true);
        groupChatView.classList.add('active');
        
        setTimeout(() => {
            if(groupChatContainer) groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
        }, 100);
    }

    function renderGroupChatHistory(isDM = false) {
        if (!groupChatContainer) return;
        groupChatContainer.innerHTML = '';
        
        const historyArray = isDM ? (currentSubChannelData.dmHistory || []) : (currentSubChannelData.groupChatHistory || []);
        if (isDM && !currentSubChannelData.dmHistory) {
            currentSubChannelData.dmHistory = historyArray;
        } else if (!isDM && !currentSubChannelData.groupChatHistory) {
            currentSubChannelData.groupChatHistory = historyArray;
        }

        historyArray.forEach(msg => {
            addGroupChatMessageToUI(msg);
        });
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    function openOfferDetailSheet(msg) {
        let sheet = document.getElementById('yt-offer-detail-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'yt-offer-detail-sheet';
            sheet.className = 'bottom-sheet-overlay detail-sheet-overlay';
            sheet.style.zIndex = '600';
            sheet.innerHTML = `
                <div class="bottom-sheet" style="height: auto; max-height: 80%;">
                    <div class="sheet-handle"></div>
                    <div class="sheet-title">商单详情</div>
                    <div class="detail-sheet-content" id="yt-offer-detail-content" style="padding-bottom: 30px;">
                    </div>
                </div>
            `;
            document.querySelector('.screen').appendChild(sheet);
            sheet.addEventListener('mousedown', (e) => {
                if (e.target === sheet) sheet.classList.remove('active');
            });
        }
        
        const contentContainer = document.getElementById('yt-offer-detail-content');
        const isAccepted = msg.offerStatus === 'accepted';
        const isRejected = msg.offerStatus === 'rejected';
        const isCompleted = msg.offerStatus === 'completed';
        const isFailed = msg.offerStatus === 'failed';

        let buttonsHtml = '';
        if (isCompleted) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #e8f5e9; border-radius: 12px; margin: 0 16px;">商单已结算完成</div>`;
        } else if (isFailed) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #ffebee; border-radius: 12px; margin: 0 16px;">商单已违约取消</div>`;
        } else if (isAccepted) {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-fail-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">违约放弃</div>
                    <div id="offer-sheet-complete-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">完成结单</div>
                </div>
            `;
        } else if (isRejected) {
            buttonsHtml = `<div style="text-align:center; padding: 12px; color: #8e8e93; font-size: 15px; background: #f2f2f2; border-radius: 12px; margin: 0 16px;">已婉拒该商单</div>`;
        } else {
            buttonsHtml = `
                <div style="display: flex; gap: 12px; margin: 0 16px;">
                    <div id="offer-sheet-reject-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #ffebee; color: #ff3b30; font-size: 15px; font-weight: 600; cursor: pointer;">婉拒</div>
                    <div id="offer-sheet-accept-btn" style="flex: 1; padding: 12px; text-align: center; border-radius: 12px; background: #e8f5e9; color: #388e3c; font-size: 15px; font-weight: 600; cursor: pointer;">接取</div>
                </div>
            `;
        }

        contentContainer.innerHTML = `
            <div style="margin: 20px 16px; background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 20px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -10px; right: -10px; opacity: 0.05; font-size: 100px; pointer-events: none;">
                    <i class="fas fa-handshake"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Subject 项目</span>
                        <span style="font-weight: 500; font-size: 16px;">${msg.offerData.title || '无'} <span style="font-size: 11px; background: #e5e5ea; padding: 2px 6px; border-radius: 4px; color: #8e8e93;">${msg.offerData.offerType || '未知'}</span></span>
                    </div>
                    <div style="font-size: 15px; color: #1c1c1e; line-height: 1.5; display: flex; flex-direction: column; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px;">
                        <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px;">Requirements 需求</span>
                        <span style="white-space: pre-wrap;">${msg.offerData.requirement || '无'}</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
                        <div style="display: flex; align-items: baseline; gap: 8px;">
                            <span style="color: #8e8e93; font-size: 12px; text-transform: uppercase; font-weight: 600;">Offer 报价</span>
                            <span style="font-size: 22px; color: #ff3b30; font-weight: 700;">${msg.offerData.price || '面议'}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="color: #8e8e93; font-size: 11px; font-weight: 500;">违约金</span>
                            <span style="font-size: 14px; color: #000; font-weight: 600;">${msg.offerData.penalty || '无'}</span>
                        </div>
                    </div>
                </div>
            </div>
            ${buttonsHtml}
        `;

        if (!isAccepted && !isRejected && !isCompleted && !isFailed) {
            setTimeout(() => {
                const acceptBtn = document.getElementById('offer-sheet-accept-btn');
                const rejectBtn = document.getElementById('offer-sheet-reject-btn');
                
                if (acceptBtn) {
                    acceptBtn.addEventListener('click', () => {
                        msg.offerStatus = 'accepted';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true); 
                        triggerGroupChatAPI("好的，我接下这个合作了，请发送具体合同或细则。");
                    });
                }
                if (rejectBtn) {
                    rejectBtn.addEventListener('click', () => {
                        msg.offerStatus = 'rejected';
                        saveYoutubeData();
                        sheet.classList.remove('active');
                        renderGroupChatHistory(true);
                        triggerGroupChatAPI("抱歉，近期档期较满，暂不接取该合作，感谢邀请。");
                    });
                }
            }, 0);
        } else if (isAccepted) {
            setTimeout(() => {
                const completeBtn = document.getElementById('offer-sheet-complete-btn');
                const failBtn = document.getElementById('offer-sheet-fail-btn');
                
                if (completeBtn) {
                    completeBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'complete');
                    });
                }
                if (failBtn) {
                    failBtn.addEventListener('click', () => {
                        sheet.classList.remove('active');
                        processOfferCompletion(msg, currentSubChannelData, 'fail');
                    });
                }
            }, 0);
        }

        sheet.classList.add('active');
    }

    function processOfferCompletion(msg, sub, actionType) {
        if (!sub.generatedContent) {
            sub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
        }
        
        if (actionType === 'complete') {
            msg.offerStatus = 'completed';
            const priceNum = parseFloat((msg.offerData.price || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission += priceNum;
            
            const type = msg.offerData.offerType || 'video';
            const title = msg.offerData.title || '合作项目';
            
            if (type === 'video') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方宣传】${title} ft. ${window.userState?.name || 'User'}`,
                    views: Math.floor(Math.random() * 50) + 10 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180',
                    comments: [{name: window.userState?.name || '我', text: '感谢官方的邀请！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '审片通过！视频已经在我们频道上线，反响很好，合作款已打入账户，期待下次合作！' });
            } else if (type === 'live') {
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift({
                    title: `【官方直播回放】${title} 合作专场`,
                    views: Math.floor(Math.random() * 20) + 5 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180',
                    comments: [{name: window.userState?.name || '我', text: '昨晚带货太有意思了！'}]
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '昨晚在您频道的直播效果爆炸！录播我们官方也同步发布了，感谢主播的热情带货！' });
            } else if (type === 'post') {
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `非常荣幸能邀请到 @${window.userState?.name || 'User'} 参与我们的 ${title} 活动！现场返图来啦~ #商业合作`,
                    likes: Math.floor(Math.random() * 10) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '社群动态已经看到了，互动率很高，感谢您的支持！' });
            } else if (type === 'collab') {
                if (!channelState.pastVideos) channelState.pastVideos = [];
                const videoObj = {
                    title: `【联动】${title} ft. ${sub.name}`,
                    views: Math.floor(Math.random() * 100) + 20 + '万 次观看',
                    time: '刚刚',
                    thumbnail: 'https://picsum.photos/seed/' + Math.random() + '/320/180',
                    comments: [{name: sub.name, text: '太好玩了下次再来！'}]
                };
                channelState.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.pastVideos) sub.generatedContent.pastVideos = [];
                sub.generatedContent.pastVideos.unshift(videoObj);
                
                if (!sub.generatedContent.communityPosts) sub.generatedContent.communityPosts = [];
                sub.generatedContent.communityPosts.unshift({
                    content: `今天和 @${window.userState?.name || 'User'} 合作了《${title}》，真是太有趣了，快去看正片！`,
                    likes: Math.floor(Math.random() * 5) + 1 + '万',
                    time: '刚刚'
                });
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '节目效果太棒了，动态我也发了，下次再一起玩！' });
            } else {
                sub.dmHistory.push({ type: 'char', name: sub.name, text: '项目已验收，合作款已结清，期待下次合作！' });
            }
            
            if(window.showToast) window.showToast('结单成功，全网数据已同步！');
            
        } else if (actionType === 'fail') {
            msg.offerStatus = 'failed';
            const penaltyNum = parseFloat((msg.offerData.penalty || '0').replace(/[^0-9.]/g, '')) || 0;
            if (!channelState.dataCenter) channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
            if (!channelState.dataCenter.commission) channelState.dataCenter.commission = 0;
            channelState.dataCenter.commission -= penaltyNum;
            
            sub.dmHistory.push({ type: 'char', name: sub.name, text: '由于您单方面违约，项目已终止，违约金已从总资产中扣除。希望下次合作能顺利。' });
            if(window.showToast) window.showToast('已违约放弃，扣除违约金');
        }
        
        saveYoutubeData();
        renderGroupChatHistory(true); 
        
        const dataCenterSheet = document.getElementById('yt-data-center-sheet');
        if (dataCenterSheet && dataCenterSheet.classList.contains('active')) {
            renderDataCenter();
        }
        
        const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
        if (activeTab && activeTab.getAttribute('data-target') === 'past') { activeTab.click(); }
    }

    function addGroupChatMessageToUI(msg) {
        if (!groupChatContainer) return;

        const row = document.createElement('div');
        
        if (msg.isOffer) {
            row.className = 'yt-bubble-row left';
            
            const isAccepted = msg.offerStatus === 'accepted';
            const isRejected = msg.offerStatus === 'rejected';
            const isCompleted = msg.offerStatus === 'completed';
            const isFailed = msg.offerStatus === 'failed';

            let statusText = '待处理';
            let statusColor = '#f57c00';
            if (isAccepted) { statusText = '已接取'; statusColor = '#388e3c'; }
            else if (isRejected) { statusText = '已婉拒'; statusColor = '#ff3b30'; }
            else if (isCompleted) { statusText = '已完成'; statusColor = '#007aff'; }
            else if (isFailed) { statusText = '已违约'; statusColor = '#8e8e93'; }

            row.innerHTML = `
                <div class="yt-bubble-avatar"><img src="${currentSubChannelData.avatar}"></div>
                <div class="yt-bubble-content" style="max-width: 80%;">
                    <div class="yt-bubble-name">${msg.name}</div>
                    <div class="yt-offer-bubble" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; margin-top: 4px;">
                        <div style="background: #007aff; color: #fff; width: 32px; height: 32px; border-radius: 8px; display: flex; justify-content: center; align-items: center;">
                            <i class="fas fa-file-signature"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 14px; font-weight: 600; color: #1c1c1e;">商务合作邀请</div>
                            <div style="font-size: 12px; color: ${statusColor}; font-weight: 500; margin-top: 2px;">状态: ${statusText}</div>
                        </div>
                    </div>
                </div>
            `;
            
            setTimeout(() => {
                const bubble = row.querySelector('.yt-offer-bubble');
                if (bubble) {
                    bubble.addEventListener('click', () => {
                        openOfferDetailSheet(msg);
                    });
                }
            }, 0);

        } else if (msg.type === 'user') {
            row.className = 'yt-bubble-row right';
            row.innerHTML = `
                <div class="yt-bubble-avatar"><img src="${window.userState?.avatarUrl || 'https://picsum.photos/100'}"></div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        } else if (msg.type === 'char') {
            row.className = 'yt-bubble-row left';
            // isDM check based on Title matching the name
            const isDMContext = groupChatTitle && groupChatTitle.textContent === currentSubChannelData.name;
            const displayName = isDMContext ? msg.name : `${msg.name} <span style="font-size: 10px; background: #ff3b30; color: white; padding: 2px 4px; border-radius: 4px; margin-left: 4px; font-weight: normal;">群主</span>`;
            
            row.innerHTML = `
                <div class="yt-bubble-avatar"><img src="${currentSubChannelData.avatar}"></div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-name" style="color: #1c1c1e; font-weight: 500; display: flex; align-items: center;">${displayName}</div>
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        } else {
            row.className = 'yt-bubble-row left';
            let hash = 0;
            for (let i = 0; i < msg.name.length; i++) hash = msg.name.charCodeAt(i) + ((hash << 5) - hash);
            const color = '#' + (hash & 0x00FFFFFF).toString(16).padStart(6, '0');
            
            row.innerHTML = `
                <div class="yt-bubble-avatar" style="background-color: ${color}; display: flex; justify-content: center; align-items: center; color: white; font-size: 14px; font-weight: bold;">
                    ${msg.name.substring(0, 1)}
                </div>
                <div class="yt-bubble-content">
                    <div class="yt-bubble-name">${msg.name}</div>
                    <div class="yt-bubble-msg">${msg.text}</div>
                </div>
            `;
        }

        groupChatContainer.appendChild(row);
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;
    }

    if (groupChatSendBtn && groupChatInput) {
        groupChatSendBtn.addEventListener('click', () => {
            triggerGroupChatAPI(groupChatInput.value.trim());
        });
        
        groupChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const text = groupChatInput.value.trim();
                if (text) {
                    const userMsg = { type: 'user', name: window.userState?.name || '我', text: text };
                    
                    const isDM = groupChatTitle.textContent === currentSubChannelData.name;
                    if (isDM) {
                        if (!currentSubChannelData.dmHistory) currentSubChannelData.dmHistory = [];
                        currentSubChannelData.dmHistory.push(userMsg);
                    } else {
                        if (!currentSubChannelData.groupChatHistory) currentSubChannelData.groupChatHistory = [];
                        currentSubChannelData.groupChatHistory.push(userMsg);
                    }
                    
                    saveYoutubeData();
                    addGroupChatMessageToUI(userMsg);
                    groupChatInput.value = '';
                }
            }
        });
    }

    async function triggerGroupChatAPI(text) {
        if (isGroupChatLoading || !currentSubChannelData) return;

        const isDM = groupChatTitle.textContent === currentSubChannelData.name;
        const targetHistory = isDM ? 
            (currentSubChannelData.dmHistory = currentSubChannelData.dmHistory || []) : 
            (currentSubChannelData.groupChatHistory = currentSubChannelData.groupChatHistory || []);

        let isUserMsg = false;
        if (text.length > 0) {
            isUserMsg = true;
            const userMsg = { type: 'user', name: window.userState?.name || '我', text: text };
            targetHistory.push(userMsg);
            saveYoutubeData();
            addGroupChatMessageToUI(userMsg);
            if(groupChatInput) groupChatInput.value = '';
        } else {
            isUserMsg = targetHistory.some(m => m.type === 'user');
        }

        isGroupChatLoading = true;
        
        const typingId = 'typing-' + Date.now();
        const typingRow = document.createElement('div');
        typingRow.className = 'yt-bubble-row left';
        typingRow.id = typingId;
        typingRow.innerHTML = `
            <div class="yt-bubble-avatar"><i class="fas fa-users" style="color:#aaa; font-size:20px; line-height:36px; text-align:center; width:100%;"></i></div>
            <div class="yt-bubble-content">
                <div class="yt-bubble-msg"><i class="fas fa-ellipsis-h fa-fade"></i></div>
            </div>
        `;
        groupChatContainer.appendChild(typingRow);
        groupChatContainer.scrollTop = groupChatContainer.scrollHeight;

        try {
            const char = currentSubChannelData;
            const userPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? (window.userState.persona || '普通粉丝') : '普通粉丝');
            
            let wbContext = '';
            if (channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
                const wbs = window.getWorldBooks();
                channelState.boundWorldBookIds.forEach(id => {
                    const boundWb = wbs.find(w => w.id === id);
                    if (boundWb && boundWb.entries) {
                        wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                    }
                });
            }

            let lastSummary = '暂无';
            if (channelState.liveSummaries && channelState.liveSummaries.length > 0) {
                const s = channelState.liveSummaries[channelState.liveSummaries.length - 1];
                lastSummary = `主题: ${s.title}, 内容: ${s.content}, 氛围: ${s.atmosphere}`;
            }

            const historyStr = targetHistory.slice(-10).map(m => `${m.name}: ${m.text}`).join('\n');

            let instructionStr = isUserMsg 
                ? `用户"${window.userState?.name || '我'}"刚刚发送了消息。请先生成其他粉丝的讨论或附和，然后你作为主播回复用户的消息（也可以带上其他粉丝）。`
                : `用户现在在潜水没有说话。请生成其他粉丝在聊天的内容，然后你作为主播偶尔插话或回复他们，展现群里的日常氛围。`;
            
            if (isDM) {
                let contextAddon = '';
                if (char.isBusiness) {
                    contextAddon = `\n注意：当前是商务私信，你扮演品牌方/赞助商（"${char.name}"）。如果用户刚刚接取了你的商单（发了同意接取之类的话），你需要表现出感谢并回复准备对接细节/合同；如果用户婉拒了，则礼貌回应。`;
                }
                instructionStr = `这是一对一私信。用户刚刚发送了消息（如果上面是用户潜水，则代表没有新消息），请你作为"${char.name}"，直接对用户"${window.userState?.name || '我'}"进行私信回复，语气要自然。${contextAddon}`;
            }

            let promptStr = channelState.groupChatPrompt || defaultGroupChatPrompt;
            let finalPrompt = promptStr
                .replace(/{char}/g, char.name || '')
                .replace(/{char_persona}/g, char.desc || '未知')
                .replace(/{user}/g, window.userState ? window.userState.name : '我')
                .replace(/{user_persona}/g, userPersona)
                .replace(/{wb_context}/g, wbContext)
                .replace(/{live_summary_context}/g, lastSummary)
                .replace(/{chat_history}/g, historyStr)
                .replace(/{trigger_instruction}/g, instructionStr);

            let endpoint = window.apiConfig.endpoint;
            if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
            if(!endpoint.endsWith('/chat/completions')) {
                endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.apiConfig.apiKey}`
                },
                body: JSON.stringify({
                    model: window.apiConfig.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: finalPrompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" } 
                })
            });

            if (!res.ok) throw new Error(`API Error`);
            const data = await res.json();
            let resultText = data.choices[0].message.content;
            resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const responseObj = JSON.parse(resultText);

            const tRow = document.getElementById(typingId);
            if (tRow) tRow.remove();

            if (!isDM && responseObj.otherFansReplies && Array.isArray(responseObj.otherFansReplies)) {
                responseObj.otherFansReplies.forEach((reply, i) => {
                    setTimeout(() => {
                        const fanMsg = { type: 'fan', name: reply.name, text: reply.text };
                        targetHistory.push(fanMsg);
                        saveYoutubeData();
                        addGroupChatMessageToUI(fanMsg);
                    }, i * 1500); 
                });
            }

            let replies = [];
            if (responseObj.charReplies && Array.isArray(responseObj.charReplies)) {
                replies = responseObj.charReplies;
            } else if (responseObj.charReply) {
                replies = [responseObj.charReply];
            }

            const baseDelay = (!isDM && responseObj.otherFansReplies ? responseObj.otherFansReplies.length : 0) * 1500 + 1000;
            
            replies.forEach((replyText, index) => {
                setTimeout(() => {
                    if (replyText) {
                        const charMsg = { type: 'char', name: char.name, text: replyText };
                        targetHistory.push(charMsg);
                        saveYoutubeData();
                        addGroupChatMessageToUI(charMsg);
                    }
                }, baseDelay + (index * 2000)); 
            });

        } catch (error) {
            console.error('Group Chat API Error:', error);
            const tRow = document.getElementById(typingId);
            if (tRow) tRow.remove();
            if(window.showToast) window.showToast('网络错误，无法获取回复');
        } finally {
            setTimeout(() => { isGroupChatLoading = false; }, 2000);
        }
    }

    const communityDetailSheet = document.getElementById('yt-community-detail-sheet');
    if (communityDetailSheet) {
        communityDetailSheet.addEventListener('mousedown', (e) => {
            if (e.target === communityDetailSheet) {
                communityDetailSheet.classList.remove('active');
            }
        });
    }

    // === Trending (榜单) Logic ===
    const trendRefreshBtn = document.getElementById('yt-trending-refresh-btn');
    const trendList = document.getElementById('yt-trending-list');
    let isTrendingLoading = false;
    let currentTrendingType = 'live';

    const trendFilterLive = document.getElementById('yt-trend-filter-live');
    const trendFilterSub = document.getElementById('yt-trend-filter-sub');

    if (trendFilterLive && trendFilterSub) {
        trendFilterLive.addEventListener('click', () => {
            trendFilterLive.classList.add('active');
            trendFilterSub.classList.remove('active');
            currentTrendingType = 'live';
            if (channelState.cachedTrendingLive && channelState.cachedTrendingLive.length > 0) {
                renderTrendingData(channelState.cachedTrendingLive);
            } else if (trendList) {
                trendList.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px;">点击右上角魔法棒生成最新榜单</div>';
            }
        });
        trendFilterSub.addEventListener('click', () => {
            trendFilterSub.classList.add('active');
            trendFilterLive.classList.remove('active');
            currentTrendingType = 'sub';
            if (channelState.cachedTrendingSub && channelState.cachedTrendingSub.length > 0) {
                renderTrendingData(channelState.cachedTrendingSub);
            } else if (trendList) {
                trendList.innerHTML = '<div style="text-align: center; color: #8e8e93; margin-top: 40px;">点击右上角魔法棒生成最新榜单</div>';
            }
        });
    }

    // 默认的 Mock 榜单数据
    const mockTrendingData = [
        { rank: 1, name: 'PewDiePie', handle: 'pewdiepie', desc: 'Gameplays, memes and everything in between.', subs: '1.11亿', videos: '4.7K', isLive: true },
        { rank: 2, name: 'MrBeast', handle: 'mrbeast', desc: 'I do crazy challenges and give away money.', subs: '2.5亿', videos: '780', isLive: false },
        { rank: 3, name: 'Markiplier', handle: 'markiplier', desc: 'Welcome to Markiplier! Here you\'ll find hilarious gaming videos.', subs: '3600万', videos: '5.4K', isLive: false },
        { rank: 4, name: 'Gawr Gura', handle: 'gawrgura', desc: 'Shark girl from Atlantis. Chumbuds assemble!', subs: '440万', videos: '500', isLive: true },
        { rank: 5, name: 'MKBHD', handle: 'markiplier', desc: 'Tech reviews and crispy videos.', subs: '1800万', videos: '1.5K', isLive: false },
        { rank: 6, name: 'IShowSpeed', handle: 'ishowspeed', desc: 'Loud, crazy, and always entertaining.', subs: '2200万', videos: '1.2K', isLive: true },
        { rank: 7, name: 'Jacksepticeye', handle: 'jacksepticeye', desc: 'Top of the mornin to ya laddies!', subs: '3000万', videos: '5.1K', isLive: false },
        { rank: 8, name: 'Dude Perfect', handle: 'dudeperfect', desc: '5 best friends and a panda.', subs: '6000万', videos: '300', isLive: false },
        { rank: 9, name: 'Valkyrae', handle: 'valkyrae', desc: 'Gaming, lifestyle and good vibes.', subs: '400万', videos: '400', isLive: true },
        { rank: 10, name: 'Sykkuno', handle: 'sykkuno', desc: 'Just playing games for fun.', subs: '290万', videos: '600', isLive: false }
    ];

    function renderTrendingData(trendingArray) {
        if (!trendList) return;
        trendList.innerHTML = '';
        
        if (trendingArray && Array.isArray(trendingArray)) {
            trendingArray.forEach(item => {
                const avatarUrl = 'https://picsum.photos/seed/' + item.handle + '/80/80';
                
                const el = document.createElement('div');
                el.className = 'yt-trending-list-item';
                
                let rankClass = '';
                if (item.rank === 1) rankClass = 'top-1';
                if (item.rank === 2) rankClass = 'top-2';
                if (item.rank === 3) rankClass = 'top-3';

                el.innerHTML = `
                    <div class="yt-trending-rank ${rankClass}">${item.rank}</div>
                    <div class="yt-video-avatar" style="width: 50px; height: 50px; flex-shrink: 0;">
                        <img src="${avatarUrl}">
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 16px; font-weight: 500; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.name}</div>
                        <div style="font-size: 12px; color: #606060; margin-top: 2px;">@${item.handle} • ${item.subs} 订阅</div>
                        <div style="font-size: 12px; color: #8e8e93; margin-top: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.desc}</div>
                    </div>
                    ${item.isLive ? '<div class="yt-live-badge" style="position:static; margin-left:10px;"><i class="fas fa-broadcast-tower"></i></div>' : ''}
                `;

                        const newCharData = {
                            id: 'char_trend_' + Date.now() + '_' + item.rank,
                            name: item.name,
                            handle: item.handle,
                            avatar: avatarUrl,
                            banner: null,
                            isLive: item.isLive,
                            desc: item.desc,
                            subs: item.subs,
                            videos: item.videos || '10'
                        };

                        el.addEventListener('click', () => {
                            openSubChannelView(newCharData);
                        });

                trendList.appendChild(el);
            });
        }
    }

    if (trendRefreshBtn && trendList) {
        trendRefreshBtn.addEventListener('click', async (e) => {
            if (e) e.stopPropagation();
            if (isTrendingLoading) return;
            
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请先配置 API，当前显示默认榜单');
                renderTrendingData(mockTrendingData);
                return;
            }

            let wbContext = '';
            if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
                const wbs = window.getWorldBooks();
                channelState.boundWorldBookIds.forEach(id => {
                    const boundWb = wbs.find(w => w.id === id);
                    if (boundWb && boundWb.entries) {
                        wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                    }
                });
            }

            isTrendingLoading = true;
            trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#8e8e93;"><i class="fas fa-spinner fa-spin" style="font-size:24px; margin-bottom:10px;"></i><p>正在拉取最新榜单数据...</p></div>';


            let prompt = "";
            if (currentTrendingType === 'live') {
                prompt = `请根据世界书生成八个正在直播的频道（NO.1-8）。
要求返回严格的JSON格式，必须完全符合以下结构：
{
  "trending": [
    {
      "rank": 1,
      "name": "频道名称",
      "handle": "账号名不带@",
      "desc": "频道简介或主播人设",
      "subs": "254万",
      "videos": "120",
      "isLive": true
    }
  ]
}
注意：isLive 必须全部设为 true。
${wbContext}
不要包含任何Markdown标记。`;
            } else {
                prompt = `请根据世界书生成NO.1-8订阅最多的人。
要求返回严格的JSON格式，必须完全符合以下结构：
{
  "trending": [
    {
      "rank": 1,
      "name": "频道名称",
      "handle": "账号名不带@",
      "desc": "频道简介或主播人设",
      "subs": "254万",
      "videos": "120",
      "isLive": false
    }
  ]
}
注意：isLive 必须全部设为 false。
${wbContext}
不要包含任何Markdown标记。`;
            }

            try {
                let endpoint = window.apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.9,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API Request Failed");
                const data = await res.json();
                
                // 更健壮的 JSON 提取正则：提取大括号或中括号内的内容，防止大模型前言不搭后语
                let rawText = data.choices[0].message.content;
                let jsonMatch = rawText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                let resultText = jsonMatch ? jsonMatch[0] : rawText;
                
                // 移除可能的 Markdown 包装
                resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
                
                let parsed;
                try {
                    parsed = JSON.parse(resultText);
                } catch (parseErr) {
                    console.error("JSON Parse Error in Trending:", parseErr, resultText);
                    if(window.showToast) window.showToast('大模型返回的格式有误，请重试');
                    trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#ff3b30;"><i class="fas fa-exclamation-triangle" style="font-size:24px; margin-bottom:10px;"></i><p>生成数据解析失败，请点击右上角重新生成</p></div>';
                    isTrendingLoading = false;
                    return;
                }

                trendList.innerHTML = '';
                
                let trendingArray = [];
                if (Array.isArray(parsed)) {
                    trendingArray = parsed;
                } else if (parsed.trending && Array.isArray(parsed.trending)) {
                    trendingArray = parsed.trending;
                } else if (typeof parsed === 'object') {
                    // Fallback if the object is unexpectedly structured
                    const keys = Object.keys(parsed);
                    if (keys.length > 0 && Array.isArray(parsed[keys[0]])) {
                        trendingArray = parsed[keys[0]];
                    } else {
                        trendingArray = [parsed]; 
                    }
                }

                if (trendingArray.length > 0) {
                    if (currentTrendingType === 'live') {
                        channelState.cachedTrendingLive = trendingArray;
                    } else {
                        channelState.cachedTrendingSub = trendingArray;
                    }
                    saveYoutubeData();
                    trendingArray.forEach(item => {
                        const avatarUrl = 'https://picsum.photos/seed/' + item.handle + '/80/80';
                        
                        const el = document.createElement('div');
                        el.className = 'yt-trending-list-item';
                        
                        let rankClass = '';
                        if (item.rank === 1) rankClass = 'top-1';
                        if (item.rank === 2) rankClass = 'top-2';
                        if (item.rank === 3) rankClass = 'top-3';

                        el.innerHTML = `
                            <div class="yt-trending-rank ${rankClass}">${item.rank}</div>
                            <div class="yt-video-avatar" style="width: 50px; height: 50px; flex-shrink: 0;">
                                <img src="${avatarUrl}">
                            </div>
                            <div style="flex: 1; overflow: hidden;">
                                <div style="font-size: 16px; font-weight: 500; color: #0f0f0f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.name}</div>
                                <div style="font-size: 12px; color: #606060; margin-top: 2px;">@${item.handle} • ${item.subs} 订阅</div>
                                <div style="font-size: 12px; color: #8e8e93; margin-top: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${item.desc}</div>
                            </div>
                            ${item.isLive ? '<div class="yt-live-badge" style="position:static; margin-left:10px;"><i class="fas fa-broadcast-tower"></i></div>' : ''}
                        `;

                        const newCharData = {
                            id: 'char_trend_' + Date.now() + '_' + item.rank,
                            name: item.name,
                            handle: item.handle,
                            avatar: avatarUrl,
                            banner: null,
                            isLive: item.isLive,
                            desc: item.desc,
                            subs: item.subs,
                            videos: item.videos || '10'
                        };

                        el.addEventListener('click', () => {
                            openSubChannelView(newCharData);
                        });

                        trendList.appendChild(el);
                    });
                }

            } catch(e) {
                console.error(e);
                trendList.innerHTML = '<div style="text-align:center; padding: 40px; color:#ff3b30;">生成失败，请重试</div>';
            } finally {
                isTrendingLoading = false;
            }
        });
    }

    // === User Live Setup & Interface ===
    const startLiveOptionBtn = ytCreateSheet ? ytCreateSheet.querySelectorAll('.yt-create-bubble-btn')[0] : null;
    
    const userLiveSetupSheet = document.getElementById('yt-user-live-setup-sheet');
    const startUserLiveBtn = document.getElementById('start-user-live-btn');
    const userLiveView = document.getElementById('yt-user-live-view');
    const userLiveBackBtn = document.getElementById('yt-user-live-back-btn');

    let userLiveBgUrl = '';
    const userLiveBgUpload = document.getElementById('yt-user-live-bg-upload');
    const userLiveBgBtn = document.getElementById('yt-user-live-bg-btn');
    const userLiveBgImg = document.getElementById('yt-user-live-bg-img');

    if (userLiveBgBtn && userLiveBgUpload) {
        userLiveBgBtn.addEventListener('click', () => userLiveBgUpload.click());
        userLiveBgUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    userLiveBgUrl = ev.target.result;
                    if(userLiveBgImg) {
                        userLiveBgImg.src = userLiveBgUrl;
                        userLiveBgImg.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (startLiveOptionBtn && userLiveSetupSheet) {
        startLiveOptionBtn.addEventListener('click', () => {
            if(ytCreateSheet) ytCreateSheet.classList.remove('active');
            userLiveSetupSheet.classList.add('active');
        });
        userLiveSetupSheet.addEventListener('mousedown', (e) => {
            if(e.target === userLiveSetupSheet) userLiveSetupSheet.classList.remove('active');
        });
    }

    // Setup sheet confirm
    if (startUserLiveBtn && userLiveView) {
        startUserLiveBtn.addEventListener('click', () => {
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';

            document.getElementById('yt-user-live-title-display').textContent = title;
            if(userLiveBgUrl) {
                document.getElementById('yt-user-live-bg-display').src = userLiveBgUrl;
            } else {
                document.getElementById('yt-user-live-bg-display').src = 'https://picsum.photos/900/600';
            }

            userLiveSetupSheet.classList.remove('active');
            
            // Clean up old state
            document.getElementById('yt-user-live-chat-container').innerHTML = '';
            document.getElementById('yt-user-live-bubbles-container').innerHTML = '';
            document.getElementById('yt-user-live-alert-container').innerHTML = '';
            userLiveHistory = [];

            userLiveView.classList.add('active');
        });
    }

    if (userLiveBackBtn) {
        userLiveBackBtn.addEventListener('click', () => {
            window.showCustomModal({
                title: '结束直播',
                message: '确定要结束当前的直播吗？',
                confirmText: '结束',
                cancelText: '继续',
                isDestructive: true,
                onConfirm: () => {
                    userLiveView.classList.remove('active');
                    
                    document.getElementById('yt-summary-views').textContent = userLiveTotalViews;
                    document.getElementById('yt-summary-hot').textContent = userLiveMaxHot;
                    document.getElementById('yt-summary-subs').textContent = '+' + userLiveNewSubs;
                    document.getElementById('yt-summary-sc').textContent = '￥' + userLiveTotalSC;
                    
                    if(userLiveSummarySheet) userLiveSummarySheet.classList.add('active');
                }
            });
        });
    }

    // Data Center Logic
    const dataCenterBtn = document.querySelector('.yt-profile-action-btn i.fa-chart-bar')?.parentElement;
    const dataCenterSheet = document.getElementById('yt-data-center-sheet');
    const ytWithdrawBtn = document.getElementById('yt-withdraw-btn');
    const dcTotalViews = document.getElementById('dc-total-views');
    const dcTotalSc = document.getElementById('dc-total-sc');
    const dcTotalSubs = document.getElementById('dc-total-subs');
    const dcTotalCommission = document.getElementById('dc-total-commission');
    const dcTotalRevenue = document.getElementById('dc-total-revenue');
    const dcOffersList = document.getElementById('dc-offers-list');

    function renderDataCenter() {
        if (!channelState.dataCenter) {
            channelState.dataCenter = { views: 0, sc: 0, subs: 0, commission: 0 };
        }
        if (channelState.dataCenter.commission === undefined) channelState.dataCenter.commission = 0;

        if (dcTotalViews) dcTotalViews.textContent = channelState.dataCenter.views || 0;
        if (dcTotalSc) dcTotalSc.textContent = (channelState.dataCenter.sc || 0).toFixed(2);
        if (dcTotalSubs) dcTotalSubs.textContent = channelState.dataCenter.subs || 0;
        if (dcTotalCommission) dcTotalCommission.textContent = (channelState.dataCenter.commission || 0).toFixed(2);
        
        const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
        if (dcTotalRevenue) dcTotalRevenue.textContent = total.toFixed(2);
        
        if (ytWithdrawBtn) {
            if (total > 0) {
                ytWithdrawBtn.style.opacity = '1';
                ytWithdrawBtn.style.pointerEvents = 'auto';
            } else {
                ytWithdrawBtn.style.opacity = '0.5';
                ytWithdrawBtn.style.pointerEvents = 'none';
            }
        }

        if (dcOffersList) {
            dcOffersList.innerHTML = '';
            let hasOffers = false;

            mockSubscriptions.forEach(sub => {
                if (sub.dmHistory) {
                    sub.dmHistory.forEach(msg => {
                        if (msg.isOffer && msg.offerStatus === 'accepted') {
                            hasOffers = true;
                            const el = document.createElement('div');
                            el.className = 'settings-item';
                            el.style.padding = '12px 16px';
                            el.style.cursor = 'pointer';

                            const priceStr = msg.offerData.price || '0';

                            el.innerHTML = `
                                <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; margin-right: 12px; flex-shrink: 0;">
                                    <img src="${sub.avatar}" style="width: 100%; height: 100%; object-fit: cover;">
                                </div>
                                <div style="flex: 1; overflow: hidden;">
                                    <div style="font-weight: 600; font-size: 15px; color: #000; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${msg.offerData.title || '商单任务'}</div>
                                    <div style="font-size: 12px; color: #8e8e93; margin-top: 2px;">来自: ${sub.name}</div>
                                </div>
                                <div style="color: #ff3b30; font-weight: 600; font-size: 15px;">${priceStr}</div>
                            `;

                            el.addEventListener('click', () => {
                                // Set global current sub so the detail sheet context works
                                currentSubChannelData = sub;
                                openOfferDetailSheet(msg);
                            });

                            dcOffersList.appendChild(el);
                        }
                    });
                }
            });

            if (!hasOffers) {
                dcOffersList.innerHTML = '<div style="padding: 16px; text-align: center; color: #8e8e93; font-size: 14px;">暂无进行中的商单</div>';
            }
        }
    }
    
    if (dataCenterBtn && dataCenterSheet) {
        dataCenterBtn.addEventListener('click', () => {
            renderDataCenter();
            dataCenterSheet.classList.add('active');
        });
        dataCenterSheet.addEventListener('mousedown', (e) => {
            if (e.target === dataCenterSheet) dataCenterSheet.classList.remove('active');
        });
    }

    if (ytWithdrawBtn) {
        ytWithdrawBtn.addEventListener('click', () => {
            const total = parseFloat(channelState.dataCenter.sc || 0) + parseFloat(channelState.dataCenter.commission || 0);
            if (total <= 0) return;

            if (window.showCustomModal) {
                window.showCustomModal({
                    title: '收益提现',
                    message: `确认将 YouTube 创作者收益 ￥${total.toFixed(2)} 提现到 Pay 钱包吗？`,
                    confirmText: '确认提现',
                    cancelText: '取消',
                    onConfirm: () => {
                        // 重置收益
                        channelState.dataCenter.sc = 0;
                        channelState.dataCenter.commission = 0;
                        saveYoutubeData();
                        renderDataCenter();

                        // 同步到 Pay App
                        if (window.addPayTransaction) {
                            window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                        }

                        if(window.showToast) window.showToast('提现成功，已存入 Pay 钱包');
                    }
                });
            } else {
                if (confirm(`确认提现 ￥${total.toFixed(2)} 吗？`)) {
                    channelState.dataCenter.sc = 0;
                    channelState.dataCenter.commission = 0;
                    saveYoutubeData();
                    renderDataCenter();
                    if (window.addPayTransaction) window.addPayTransaction(total, 'YouTube 创作者收益', 'income');
                    alert('提现成功！');
                }
            }
        });
    }

    // User Live Chat & API interaction
    let userLiveHistory = [];
    let userLiveComments = [];
    let userLiveTotalSC = 0;
    let userLiveTotalViews = 0;
    let userLiveMaxHot = 0;
    let userLiveNewSubs = 0;

    const userLiveChatInput = document.getElementById('yt-user-live-chat-input');
    const userLiveChatSend = document.getElementById('yt-user-live-chat-send');
    const userLiveBubblesContainer = document.getElementById('yt-user-live-bubbles-container');
    const userLiveChatContainer = document.getElementById('yt-user-live-chat-container');
    const userLiveTriggerApiBtn = document.getElementById('yt-user-live-trigger-api-btn');

    if (startUserLiveBtn) {
        startUserLiveBtn.addEventListener('click', () => {
            userLiveComments = [];
            userLiveTotalSC = 0;
            userLiveTotalViews = Math.floor(Math.random() * 500) + 100;
            userLiveMaxHot = userLiveTotalViews;
            userLiveNewSubs = 0;
            const viewsEl = document.getElementById('yt-user-live-views-display');
            if(viewsEl) viewsEl.textContent = userLiveTotalViews + ' 人正在观看';
        });
    }

    const userLiveMinimizeBtn = document.getElementById('yt-user-live-minimize-btn');
    if (userLiveMinimizeBtn) {
        userLiveMinimizeBtn.addEventListener('click', () => {
            if(userLiveView) userLiveView.classList.remove('active');
            if(window.showToast) window.showToast('直播已最小化并在后台运行');
            
            // Generate a fake active live stream for the user in the channel list
            if(ytUserState) {
                const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
                if(existingIndex > -1) mockVideos.splice(existingIndex, 1);
                
                const titleInput = document.getElementById('yt-user-live-title-input');
                const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';
                
                mockVideos.unshift({
                    title: title,
                    views: userLiveTotalViews + ' 人正在观看',
                    time: 'LIVE',
                    thumbnail: userLiveBgUrl || 'https://picsum.photos/320/180',
                    isLive: true,
                    comments: [],
                    initialBubbles: [],
                    guest: userLiveSelectedGuest,
                    channelData: {
                        id: 'user_channel_id',
                        name: ytUserState.name || '我',
                        avatar: ytUserState.avatarUrl || 'https://picsum.photos/80/80',
                        subs: ytUserState.subs || '0'
                    }
                });
                renderVideos();
            }
        });
    }

    const userLiveSummarySheet = document.getElementById('yt-user-live-summary-sheet');
    const ytSummaryConfirmBtn = document.getElementById('yt-summary-confirm-btn');

    if (userLiveSummarySheet) {
        userLiveSummarySheet.addEventListener('mousedown', (e) => {
            if (e.target === userLiveSummarySheet) userLiveSummarySheet.classList.remove('active');
        });
    }

    if (ytSummaryConfirmBtn && userLiveSummarySheet) {
        ytSummaryConfirmBtn.addEventListener('click', () => {
            userLiveSummarySheet.classList.remove('active');
            if(window.showToast) window.showToast('录播已保存至往期记录');
            
            const existingIndex = mockVideos.findIndex(v => v.channelData && v.channelData.id === 'user_channel_id');
            if(existingIndex > -1) mockVideos.splice(existingIndex, 1);

            // Update Data Center
            if (!channelState.dataCenter) {
                channelState.dataCenter = { views: 0, sc: 0, subs: 0 };
            }
            channelState.dataCenter.views += userLiveTotalViews;
            channelState.dataCenter.sc += userLiveTotalSC;
            if (!channelState.dataCenter.subs) channelState.dataCenter.subs = 0;
            channelState.dataCenter.subs += userLiveNewSubs;
            
            if(ytUserState) {
                const currentSubsNum = parseSubs(ytUserState.subs);
                ytUserState.subs = formatSubs(currentSubsNum + userLiveNewSubs);

                const currentNumStr = (ytUserState.videos || '0').replace(/[^0-9]/g, '');
                let currentNum = parseInt(currentNumStr) || 0;
                ytUserState.videos = (currentNum + 1).toString();
                syncYtProfile();
            }

            // Save to Past Videos
            if (!channelState.pastVideos) channelState.pastVideos = [];
            const titleInput = document.getElementById('yt-user-live-title-input');
            const title = titleInput && titleInput.value ? titleInput.value : '我的直播间';
            const pastVid = {
                title: title,
                views: userLiveTotalViews + ' 次观看',
                time: '刚刚',
                thumbnail: userLiveBgUrl || 'https://picsum.photos/seed/user_past/320/180',
                comments: [...userLiveComments],
                guest: userLiveSelectedGuest 
            };
            channelState.pastVideos.unshift(pastVid);
            
            // Sync to Guest Profile
            if (userLiveSelectedGuest) {
                const guestSub = mockSubscriptions.find(s => s.id === userLiveSelectedGuest.id);
                if (guestSub) {
                    if (!guestSub.generatedContent) {
                        guestSub.generatedContent = { pastVideos: [], communityPosts: [], currentLive: null, fanGroup: null };
                    }
                    if (!guestSub.generatedContent.pastVideos) guestSub.generatedContent.pastVideos = [];
                    guestSub.generatedContent.pastVideos.unshift({
                        title: `【联动录播】${title}`,
                        views: Math.floor(userLiveTotalViews * 0.8) + ' 次观看',
                        time: '刚刚',
                        thumbnail: pastVid.thumbnail,
                        comments: [{name: window.userState?.name || '我', text: '这把打得不错！'}],
                        guest: { name: window.userState?.name || '我' }
                    });
                }
            }

            saveYoutubeData();

            renderVideos();
            
            // Force refresh profile tab if active
            const activeTab = document.querySelector('#profile-main-tabs .yt-sliding-tab.active');
            if (activeTab && activeTab.getAttribute('data-target') === 'past') {
                activeTab.click(); 
            }
        });
    }

    if (userLiveChatSend && userLiveChatInput) {
        const sendAction = () => {
            const text = userLiveChatInput.value.trim();
            if(!text) return;

            userLiveHistory.push({ type: 'host', text: text });
            
            // Create bubble on screen
            const bubble = document.createElement('div');
            bubble.className = 'yt-user-live-bubble';
            bubble.textContent = text;
            userLiveBubblesContainer.appendChild(bubble);

            setTimeout(() => {
                bubble.style.opacity = '0';
                bubble.style.transition = 'opacity 1s ease';
                setTimeout(() => bubble.remove(), 1000);
            }, 8000);

            userLiveChatInput.value = '';
        };

        userLiveChatSend.addEventListener('click', sendAction);
        userLiveChatInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') sendAction();
        });
    }

    if (userLiveTriggerApiBtn) {
        userLiveTriggerApiBtn.addEventListener('click', async () => {
            if (!window.apiConfig || !window.apiConfig.endpoint || !window.apiConfig.apiKey) {
                if(window.showToast) window.showToast('请配置API');
                return;
            }

            userLiveTriggerApiBtn.style.opacity = '0.5';
            userLiveTriggerApiBtn.style.pointerEvents = 'none';
            userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 等待中';

            let wbContext = '';
            if (channelState && channelState.boundWorldBookIds && Array.isArray(channelState.boundWorldBookIds) && window.getWorldBooks) {
                const wbs = window.getWorldBooks();
                channelState.boundWorldBookIds.forEach(id => {
                    const boundWb = wbs.find(w => w.id === id);
                    if (boundWb && boundWb.entries) {
                        wbContext += `\n【${boundWb.name}】:\n` + boundWb.entries.map(e => `${e.keyword}: ${e.content}`).join('\n');
                    }
                });
            }

            const hostName = window.userState ? window.userState.name : '我';
            const hostPersona = (ytUserState && ytUserState.persona) ? ytUserState.persona : (window.userState ? window.userState.persona : '普通主播');
            const recentHostMsg = userLiveHistory.slice(-5).map(m => m.text).join(' | ');

            let guestContextStr = userLiveSelectedGuest 
                ? `\n特别注意：本场直播你邀请的联动嘉宾是"${userLiveSelectedGuest.name}"，ta的人设："${userLiveSelectedGuest.desc || '未知'}"。观众的反应可能会带有对嘉宾的互动和评价。`
                : "";

            const prompt = `我（${hostName}）正在进行YouTube直播。我的人设是：${hostPersona}。${guestContextStr}
世界观设定：${wbContext}
我刚刚在直播里说了/做了这些事情："${recentHostMsg}"。

请根据世界书、我的人设和我刚刚发送的内容，生成观众对我的实时反应。要求生成5-10条评论和0-2条SC。
返回严格的JSON格式，必须完全符合以下结构：
{
  "comments": [
    {"name": "观众1", "text": "弹幕内容"},
    {"name": "观众2", "text": "弹幕内容"}
  ],
  "superchats": [
    {"name": "土豪", "text": "留言", "amount": 100, "color": "#e65100"}
  ],
  "newSubs": ["新粉丝A", "新粉丝B"]
}
要求：
1. comments 必须包含 5 到 10 条评论，符合直播间氛围。
2. superchats 必须包含 0 到 2 条打赏（amount是数字）。
3. newSubs 可以为空数组 []，或者包含 1-3 个名字。
4. 绝对不要返回 Markdown 标记，只能返回纯JSON。`;

            try {
                let endpoint = window.apiConfig.endpoint;
                if(endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
                if(!endpoint.endsWith('/chat/completions')) {
                    endpoint = endpoint.endsWith('/v1') ? endpoint + '/chat/completions' : endpoint + '/v1/chat/completions';
                }

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.apiConfig.apiKey}`
                    },
                    body: JSON.stringify({
                        model: window.apiConfig.model || 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.8,
                        response_format: { type: "json_object" } 
                    })
                });

                if (!res.ok) throw new Error("API failed");
                const data = await res.json();
                let resultText = data.choices[0].message.content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                
                let parsed;
                try {
                    parsed = JSON.parse(resultText);
                } catch (parseErr) {
                    console.error("JSON Parse Error in Live Audience:", parseErr, resultText);
                    if(window.showToast) window.showToast('观众反应格式生成失败，请重试');
                    return;
                }

                // Simulate Streaming
                let totalDelay = 0;
                
                // Add Comments
                if (parsed.comments && Array.isArray(parsed.comments)) {
                    parsed.comments.forEach(c => {
                        totalDelay += Math.floor(Math.random() * 1500) + 500;
                        setTimeout(() => {
                            addUserLiveChatMessage(c.name, c.text, null, null);
                        }, totalDelay);
                    });
                }

                // Add SC
                if (parsed.superchats && Array.isArray(parsed.superchats)) {
                    parsed.superchats.forEach(sc => {
                        totalDelay += 2000;
                        setTimeout(() => {
                            addUserLiveChatMessage(sc.name, sc.text, sc.amount, sc.color);
                            const amountNum = parseFloat(sc.amount) || 0;
                            userLiveTotalSC += amountNum;
                        }, totalDelay);
                    });
                }

                // Add Subs Alerts
                const alertContainer = document.getElementById('yt-user-live-alert-container');
                if (parsed.newSubs && Array.isArray(parsed.newSubs) && alertContainer) {
                    parsed.newSubs.forEach(subName => {
                        setTimeout(() => {
                            const alert = document.createElement('div');
                            alert.className = 'yt-user-live-alert';
                            alert.innerHTML = `<i class="fas fa-bell"></i> ${subName} 刚刚订阅了你！`;
                            
                            // random vertical position
                            alert.style.top = Math.floor(Math.random() * 80) + '%';
                            
                            alertContainer.appendChild(alert);
                            setTimeout(() => alert.remove(), 5000);
                            
                            userLiveNewSubs += 1;
                            
                            // increment viewer count
                            const viewsEl = document.getElementById('yt-user-live-views-display');
                            if(viewsEl) {
                                let currentNum = parseInt(viewsEl.textContent) || 0;
                                const addedViews = Math.floor(Math.random() * 50) + 10;
                                currentNum += addedViews;
                                userLiveTotalViews += addedViews;
                                if(userLiveTotalViews > userLiveMaxHot) userLiveMaxHot = userLiveTotalViews;
                                viewsEl.textContent = currentNum + ' 人正在观看';
                            }
                        }, Math.floor(Math.random() * totalDelay));
                    });
                }

            } catch (e) {
                console.error(e);
                if(window.showToast) window.showToast('无法获取观众反应');
            } finally {
                userLiveTriggerApiBtn.style.opacity = '1';
                userLiveTriggerApiBtn.style.pointerEvents = 'auto';
                userLiveTriggerApiBtn.innerHTML = '<i class="fas fa-magic"></i> 观众反应';
            }
        });
    }

    function addUserLiveChatMessage(name, text, amount, color) {
        if (!userLiveChatContainer) return;
        userLiveComments.push({ name: name, text: text });

        const row = document.createElement('div');
        
        if (amount) {
            row.style.backgroundColor = color || '#1565c0';
            row.style.padding = '8px 12px';
            row.style.borderRadius = '8px';
            row.style.marginBottom = '4px';
            row.innerHTML = `
                <div style="font-weight: bold; font-size: 13px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">${name} <span style="margin-left: 8px;">￥${amount}</span></div>
                <div style="font-size: 14px; color: #fff;">${text}</div>
            `;
        } else {
            row.style.display = 'flex';
            row.style.gap = '8px';
            row.style.alignItems = 'flex-start';
            row.style.marginBottom = '12px';
            
            const randColor = '#' + Math.floor(Math.random()*16777215).toString(16);
            
            row.innerHTML = `
                <div style="width:24px; height:24px; border-radius:50%; background-color:${randColor}; display:flex; justify-content:center; align-items:center; color:#fff; font-size:10px; font-weight:bold; flex-shrink:0;">
                    ${name && name.length > 0 ? name[0].toUpperCase() : '?'}
                </div>
                <div style="font-size:13px; margin-top:2px;">
                    <span style="font-size:12px; margin-right:4px; color:#606060;">${name}</span>
                    <span style="color:#0f0f0f;">${text}</span>
                </div>
            `;
        }
        
        userLiveChatContainer.appendChild(row);
        userLiveChatContainer.scrollTop = userLiveChatContainer.scrollHeight;
    }

});
