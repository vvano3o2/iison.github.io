document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let payTransactions = [];
    let investProfit = 12.5; // Mock starting profit

    // Load Data
    try {
        const saved = localStorage.getItem('ios_pay_transactions');
        if (saved) {
            payTransactions = JSON.parse(saved);
        } else {
            // Initial mock data
            payTransactions = [
                { id: 1, title: '麦当劳便利店', amount: -32.50, time: new Date(Date.now() - 86400000).getTime(), icon: 'fa-hamburger', color: '#ff9500' },
                { id: 2, title: '滴滴出行', amount: -15.00, time: new Date(Date.now() - 86400000 * 2).getTime(), icon: 'fa-car', color: '#007aff' }
            ];
        }
    } catch(e) {}

    // Global API to add transactions
    window.addPayTransaction = function(amount, title, type = 'income') {
        const newTx = {
            id: Date.now(),
            title: title || '未知交易',
            amount: type === 'income' ? parseFloat(amount) : -parseFloat(amount),
            time: Date.now(),
            icon: type === 'income' ? 'fa-arrow-down' : 'fa-shopping-bag',
            color: type === 'income' ? '#34c759' : '#ff3b30'
        };
        payTransactions.unshift(newTx);
        savePayData();
        renderPayUI();
        if (window.showToast) window.showToast(`已到账 ￥${amount.toFixed(2)}`);
    };

    function savePayData() {
        localStorage.setItem('ios_pay_transactions', JSON.stringify(payTransactions));
    }

    // --- DOM Elements ---
    const payAppBtn = document.getElementById('app-icon-1');
    const payView = document.getElementById('pay-view');
    const payBackBtn = document.getElementById('pay-back-btn');
    
    // Tabs
    const segmentBtns = document.querySelectorAll('.pay-segment-btn');
    const tabs = document.querySelectorAll('.pay-tab');
    
    // UI Elements
    const totalAmountEl = document.getElementById('pay-total-amount');
    const billListEl = document.getElementById('pay-bill-list');
    const investAmountEl = document.getElementById('pay-invest-amount');
    const investProfitEl = document.getElementById('pay-invest-profit');
    const marketNewsEl = document.getElementById('pay-market-news');

    // Modals
    const btnScan = document.getElementById('pay-action-scan');
    const scanModal = document.getElementById('pay-scan-modal');
    const scanClose = document.getElementById('pay-scan-close');
    
    const btnCards = document.getElementById('pay-action-cards');
    const cardsSheet = document.getElementById('pay-cards-sheet');

    // --- App Launch/Close ---
    if (payAppBtn && payView) {
        payAppBtn.addEventListener('click', () => {
            if (window.syncUIs) window.syncUIs();
            payView.style.display = 'flex';
            // Slight delay for transition if needed
            renderPayUI();
            randomizeMarket();
        });
    }

    if (payBackBtn && payView) {
        payBackBtn.addEventListener('click', () => {
            payView.style.display = 'none';
        });
    }

    // Use Home Bar to close apps
    const homeBar = document.getElementById('home-bar');
    if (homeBar && payView) {
        homeBar.addEventListener('click', () => {
            payView.style.display = 'none';
        });
    }

    // --- Tab Switching ---
    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segmentBtns.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            const targetTab = document.getElementById(targetId);
            if(targetTab) targetTab.classList.add('active');
        });
    });

    // --- Rendering Logic ---
    function renderPayUI() {
        // Calculate Total
        let total = 1000.00; // Base money
        payTransactions.forEach(tx => total += tx.amount);
        
        if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
        if (investAmountEl) investAmountEl.textContent = (total * 0.4).toFixed(2); // Mock invest portion
        
        if (investProfitEl) {
            investProfitEl.textContent = (investProfit >= 0 ? '+' : '') + investProfit.toFixed(2);
            investProfitEl.className = investProfit >= 0 ? 'pay-positive' : 'pay-negative';
        }

        // Render List
        if (billListEl) {
            billListEl.innerHTML = '';
            if (payTransactions.length === 0) {
                billListEl.innerHTML = '<div class="pay-empty-state">暂无交易记录</div>';
            } else {
                payTransactions.forEach(tx => {
                    const el = document.createElement('div');
                    el.className = 'pay-bill-item';
                    
                    const date = new Date(tx.time);
                    const timeStr = `${date.getMonth()+1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    
                    const amountStr = (tx.amount > 0 ? '+' : '') + tx.amount.toFixed(2);
                    const amountClass = tx.amount > 0 ? 'pay-positive' : '';

                    el.innerHTML = `
                        <div class="pay-bill-icon" style="background-color: ${tx.color};">
                            <i class="fas ${tx.icon}"></i>
                        </div>
                        <div class="pay-bill-info">
                            <div class="pay-bill-title">${tx.title}</div>
                            <div class="pay-bill-time">${timeStr}</div>
                        </div>
                        <div class="pay-bill-amount ${amountClass}">${amountStr}</div>
                    `;
                    billListEl.appendChild(el);
                });
            }
        }
    }

    // --- Randomize Market News for Liveliness ---
    function randomizeMarket() {
        const news = [
            "市场行情波动较大，请谨慎投资。",
            "今日科技板块领涨，注意风险控制。",
            "央行发布新政策，货币基金收益率小幅下调。",
            "海外资产表现强劲，可适当关注。",
            "大盘持续震荡，定投也许是好选择。"
        ];
        if (marketNewsEl) {
            marketNewsEl.textContent = news[Math.floor(Math.random() * news.length)];
        }

        // Randomly fluctuate profit slightly
        investProfit += (Math.random() * 10) - 4; // -4 to +6
        if (investProfitEl) {
            investProfitEl.textContent = (investProfit >= 0 ? '+' : '') + investProfit.toFixed(2);
            investProfitEl.className = investProfit >= 0 ? 'pay-positive' : 'pay-negative';
        }
    }

    // --- Modals Logic ---
    if (btnScan && scanModal) {
        btnScan.addEventListener('click', () => {
            scanModal.classList.add('active');
        });
    }

    if (scanClose && scanModal) {
        scanClose.addEventListener('click', () => {
            scanModal.classList.remove('active');
        });
    }

    if (btnCards && cardsSheet) {
        btnCards.addEventListener('click', () => {
            if (window.openView) window.openView(cardsSheet);
            else cardsSheet.classList.add('active');
        });
    }

    if (cardsSheet) {
        cardsSheet.addEventListener('mousedown', (e) => {
            if (e.target === cardsSheet) {
                if (window.closeView) window.closeView(cardsSheet);
                else cardsSheet.classList.remove('active');
            }
        });
    }

    // Initialize mock click for transfer to show liveliness
    const btnTransfer = document.getElementById('pay-action-transfer');
    if (btnTransfer) {
        btnTransfer.addEventListener('click', () => {
            if (window.showCustomModal) {
                window.showCustomModal({
                    type: 'prompt',
                    title: '转账给好友',
                    placeholder: '输入转账金额',
                    confirmText: '转账',
                    onConfirm: (val) => {
                        const amount = parseFloat(val);
                        if (!isNaN(amount) && amount > 0) {
                            window.addPayTransaction(amount, '转账给好友', 'expense');
                        } else {
                            if (window.showToast) window.showToast('金额无效');
                        }
                    }
                });
            }
        });
    }
});
