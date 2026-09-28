let currentUser = localStorage.getItem('smart_active_user') || null;
let cart = [];
let selectedCustomer = null;
let selectedServiceForOrder = null;

let dbCashiers = [];
let dbServices = [];
let dbCustomers = [];
let dbTransactions = [];

window.addEventListener('DOMContentLoaded', () => {
    // Tampilkan tampilan awal seketika agar tidak infinite loading
    if (currentUser) {
        showKasirPage();
    } else {
        showLoginPage();
    }

    // Sambungkan data Firebase secara asynchronous di latar belakang
    setTimeout(() => {
        initFirebaseListeners();
    }, 300);
});

function initFirebaseListeners() {
    if (!window.db) return;

    // 1. Kasir
    window.dbOnValue(window.dbRef(window.db, 'cashiers'), (snapshot) => {
        if (snapshot.exists()) {
            dbCashiers = Object.entries(snapshot.val()).map(([key, val]) => ({ firebaseKey: key, ...val }));
        } else {
            const defaultCashier = { username: 'admin', password: '123' };
            window.dbSet(window.dbRef(window.db, 'cashiers/admin'), defaultCashier);
        }
    });

    // 2. Layanan
    window.dbOnValue(window.dbRef(window.db, 'services'), (snapshot) => {
        if (snapshot.exists()) {
            dbServices = Object.entries(snapshot.val()).map(([key, val]) => ({ firebaseKey: key, ...val }));
        } else {
            const defaults = [
                { id: 1, name: 'Cuci Kiloan Reguler', price: 7000, unit: 'kg' },
                { id: 2, name: 'Cuci + Setrika', price: 10000, unit: 'kg' },
                { id: 3, name: 'Setrika Saja', price: 5000, unit: 'kg' },
                { id: 4, name: 'Cuci Selimut / Bedcover', price: 25000, unit: 'pcs' }
            ];
            defaults.forEach(s => window.dbSet(window.dbRef(window.db, 'services/' + s.id), s));
        }
        renderServicesForKasir();
    });

    // 3. Pelanggan
    window.dbOnValue(window.dbRef(window.db, 'customers'), (snapshot) => {
        if (snapshot.exists()) {
            dbCustomers = Object.entries(snapshot.val()).map(([key, val]) => ({ firebaseKey: key, ...val }));
        } else {
            dbCustomers = [];
        }
        renderCustomerList();
    });

    // 4. Transaksi
    window.dbOnValue(window.dbRef(window.db, 'transactions'), (snapshot) => {
        if (snapshot.exists()) {
            dbTransactions = Object.entries(snapshot.val()).map(([key, val]) => ({ firebaseKey: key, ...val }));
            dbTransactions.sort((a, b) => b.id.localeCompare(a.id));
        } else {
            dbTransactions = [];
        }
        if (document.getElementById('page-riwayat') && !document.getElementById('page-riwayat').classList.contains('hidden')) {
            renderTransactionHistory();
        }
    });
}

function showLoginPage() {
    document.getElementById('page-login').classList.remove('hidden');
    document.getElementById('page-kasir').classList.add('hidden');
    document.getElementById('page-pelanggan').classList.add('hidden');
    document.getElementById('page-riwayat').classList.add('hidden');
    document.getElementById('bottom-nav').classList.add('hidden');
}

function showKasirPage() {
    document.getElementById('page-login').classList.add('hidden');
    document.getElementById('page-kasir').classList.remove('hidden');
    document.getElementById('page-pelanggan').classList.add('hidden');
    document.getElementById('page-riwayat').classList.add('hidden');
    document.getElementById('bottom-nav').classList.remove('hidden');
    const cashierLabel = document.getElementById('current-cashier-label');
    if(cashierLabel) cashierLabel.innerText = currentUser;
    highlightNav('kasir');
    renderServicesForKasir();
}

function switchTab(tabName) {
    document.getElementById('page-kasir').classList.add('hidden');
    document.getElementById('page-pelanggan').classList.add('hidden');
    document.getElementById('page-riwayat').classList.add('hidden');

    highlightNav(tabName);

    if (tabName === 'kasir') {
        document.getElementById('page-kasir').classList.remove('hidden');
        renderServicesForKasir();
    } else if (tabName === 'pelanggan') {
        document.getElementById('page-pelanggan').classList.remove('hidden');
        renderCustomerList();
    } else if (tabName === 'riwayat') {
        document.getElementById('page-riwayat').classList.remove('hidden');
        renderTransactionHistory();
    }
}

function highlightNav(tab) {
    ['kasir', 'pelanggan', 'riwayat'].forEach(t => {
        const btn = document.getElementById(`nav-btn-${t}`);
        if(!btn) return;
        if (t === tab) {
            btn.classList.remove('text-slate-400');
            btn.classList.add('text-blue-600');
        } else {
            btn.classList.remove('text-blue-600');
            btn.classList.add('text-slate-400');
        }
    });
}

function handleLogin(e) {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();

    // Cek dari cache database kasir, jika kosong sediakan default admin/123
    const found = dbCashiers.length > 0 
        ? dbCashiers.find(c => c.username === user && c.password === pass)
        : (user === 'admin' && pass === '123' ? { username: 'admin' } : null);

    if (found) {
        currentUser = user;
        localStorage.setItem('smart_active_user', currentUser);
        showKasirPage();
        document.getElementById('form-login').reset();
    } else {
        alert('Username atau Password salah!');
    }
}

function logout() {
    if (confirm('Yakin ingin keluar dari aplikasi kasir?')) {
        currentUser = null;
        localStorage.removeItem('smart_active_user');
        showLoginPage();
    }
}

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
}

function openSettingsModal() {
    document.getElementById('modal-settings').classList.remove('hidden');
    renderCashierList();
}

function closeSettingsModal() {
    document.getElementById('modal-settings').classList.add('hidden');
}

function renderCashierList() {
    const container = document.getElementById('cashier-list-container');
    if(!container) return;
    container.innerHTML = '';

    dbCashiers.forEach((c, index) => {
        container.innerHTML += `
            <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                    <span class="font-bold text-slate-700">${c.username}</span>
                    <div class="relative mt-1">
                        <input type="password" id="edit-pass-${index}" value="${c.password}" class="px-2 py-1 bg-slate-50 border rounded text-[11px] w-28 pr-6" disabled>
                        <button type="button" onclick="togglePasswordVisibility('edit-pass-${index}', this)" class="absolute right-2 top-1.5 text-slate-400 text-[10px]"><i class="fa-solid fa-eye-slash"></i></button>
                    </div>
                </div>
                <div class="space-x-1">
                    <button onclick="enableEditCashier(${index})" id="btn-edit-${index}" class="px-2 py-1 bg-amber-500 text-white rounded text-[10px] font-semibold">Edit</button>
                    <button onclick="saveEditCashier('${c.firebaseKey}', ${index})" id="btn-save-${index}" class="hidden px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold">Simpan</button>
                    ${dbCashiers.length > 1 ? `<button onclick="deleteCashier('${c.firebaseKey}')" class="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-semibold"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    });
}

function enableEditCashier(index) {
    if (confirm('Konfirmasi: Anda ingin mengubah data/password kasir ini?')) {
        document.getElementById(`edit-pass-${index}`).removeAttribute('disabled');
        document.getElementById(`btn-edit-${index}`).classList.add('hidden');
        document.getElementById(`btn-save-${index}`).classList.remove('hidden');
    }
}

function saveEditCashier(firebaseKey, index) {
    const newPass = document.getElementById(`edit-pass-${index}`).value;
    if (!newPass) {
        alert('Password tidak boleh kosong!');
        return;
    }

    if (confirm('Simpan perubahan password kasir ke server?')) {
        window.dbUpdate(window.dbRef(window.db, 'cashiers/' + firebaseKey), { password: newPass })
            .then(() => {
                alert('Password berhasil diperbarui!');
                renderCashierList();
            });
    }
}

function addCashier(e) {
    e.preventDefault();
    const user = document.getElementById('new-cashier-user').value.trim();
    const pass = document.getElementById('new-cashier-pass').value.trim();

    if (dbCashiers.some(c => c.username === user)) {
        alert('Username kasir sudah terdaftar!');
        return;
    }

    if (confirm(`Konfirmasi: Tambah kasir baru dengan username "${user}"?`)) {
        window.dbSet(window.dbRef(window.db, 'cashiers/' + user), { username: user, password: pass })
            .then(() => {
                alert('Kasir baru berhasil ditambahkan!');
                document.getElementById('new-cashier-user').value = '';
                document.getElementById('new-cashier-pass').value = '';
                renderCashierList();
            });
    }
}

function deleteCashier(firebaseKey) {
    if (confirm('Konfirmasi: Hapus akun kasir ini?')) {
        window.dbRemove(window.dbRef(window.db, 'cashiers/' + firebaseKey))
            .then(() => renderCashierList());
    }
}

function openCustomerModal(firebaseKey = null) {
    document.getElementById('modal-customer').classList.remove('hidden');
    document.getElementById('form-customer').reset();
    document.getElementById('cust-edit-id').value = '';
    document.getElementById('customer-modal-title').innerText = 'Tambah Pelanggan Baru';

    if (firebaseKey) {
        const cust = dbCustomers.find(c => c.firebaseKey === firebaseKey);
        if (cust) {
            document.getElementById('customer-modal-title').innerText = 'Edit Data Pelanggan';
            document.getElementById('cust-edit-id').value = cust.firebaseKey;
            document.getElementById('cust-name').value = cust.name;
            document.getElementById('cust-phone').value = cust.phone;
            document.getElementById('cust-address').value = cust.address || '';
        }
    }
}

function closeCustomerModal() {
    document.getElementById('modal-customer').classList.add('hidden');
}

function saveCustomer(e) {
    e.preventDefault();
    const firebaseKey = document.getElementById('cust-edit-id').value;
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    if (firebaseKey) {
        if (confirm('Konfirmasi: Simpan perubahan data pelanggan ini?')) {
            window.dbUpdate(window.dbRef(window.db, 'customers/' + firebaseKey), { name, phone, address })
                .then(() => {
                    alert('Data pelanggan berhasil diperbarui!');
                    closeCustomerModal();
                });
        }
    } else {
        if (confirm(`Konfirmasi: Tambah pelanggan baru "${name}"?`)) {
            const newRef = window.dbPush(window.dbRef(window.db, 'customers'));
            window.dbSet(newRef, { id: Date.now(), name, phone, address })
                .then(() => {
                    alert('Pelanggan berhasil ditambahkan!');
                    closeCustomerModal();
                });
        }
    }
}

function filterCustomers() {
    const keyword = document.getElementById('search-customer').value.toLowerCase();
    const dropdown = document.getElementById('customer-dropdown');

    if (!keyword) {
        dropdown.classList.add('hidden');
        return;
    }

    const filtered = dbCustomers.filter(c => c.name.toLowerCase().includes(keyword) || c.phone.includes(keyword));
    
    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="p-2 text-xs text-slate-400 text-center">Pelanggan tidak ditemukan</div>`;
    } else {
        dropdown.innerHTML = '';
        filtered.forEach(c => {
            dropdown.innerHTML += `
                <div onclick="selectCustomer('${c.firebaseKey}')" class="p-2.5 hover:bg-slate-50 cursor-pointer text-xs">
                    <p class="font-bold text-slate-700">${c.name}</p>
                    <p class="text-[10px] text-slate-500">${c.phone}</p>
                </div>
            `;
        });
    }
    dropdown.classList.remove('hidden');
}

function selectCustomer(firebaseKey) {
    selectedCustomer = dbCustomers.find(c => c.firebaseKey === firebaseKey);
    if (selectedCustomer) {
        document.getElementById('search-customer').value = '';
        document.getElementById('customer-dropdown').classList.add('hidden');
        document.getElementById('selected-customer-info').classList.remove('hidden');
        document.getElementById('sel-cust-name').innerText = selectedCustomer.name;
        document.getElementById('sel-cust-phone').innerText = `${selectedCustomer.phone} • ${selectedCustomer.address || 'Tanpa Alamat'}`;
    }
}

function resetSelectedCustomer() {
    selectedCustomer = null;
    document.getElementById('selected-customer-info').classList.add('hidden');
}

function renderCustomerList() {
    const container = document.getElementById('customer-list-container');
    if (!container) return;
    const keyword = document.getElementById('search-customer-page') ? document.getElementById('search-customer-page').value.toLowerCase() : '';
    
    const filtered = dbCustomers.filter(c => c.name.toLowerCase().includes(keyword) || c.phone.includes(keyword));
    container.innerHTML = '';

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Belum ada data pelanggan</p>`;
        return;
    }

    filtered.forEach(c => {
        container.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-xs">
                <div>
                    <h4 class="font-bold text-xs text-slate-800">${c.name}</h4>
                    <p class="text-[11px] text-slate-500"><i class="fa-solid fa-phone mr-1"></i>${c.phone}</p>
                    <p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot mr-1"></i>${c.address || '-'}</p>
                </div>
                <div class="space-x-1">
                    <button onclick="openCustomerModal('${c.firebaseKey}')" class="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteCustomer('${c.firebaseKey}')" class="px-2.5 py-1 bg-red-500 text-white rounded-lg text-xs"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function deleteCustomer(firebaseKey) {
    if (confirm('Konfirmasi: Hapus data pelanggan ini?')) {
        window.dbRemove(window.dbRef(window.db, 'customers/' + firebaseKey));
    }
}

function openServicesModal() {
    document.getElementById('modal-services').classList.remove('hidden');
    renderServicesManageList();
}

function closeServicesModal() {
    document.getElementById('modal-services').classList.add('hidden');
    const formServ = document.getElementById('form-service');
    if(formServ) formServ.reset();
    const servId = document.getElementById('serv-id');
    if(servId) servId.value = '';
    const servTitle = document.getElementById('service-form-title');
    if(servTitle) servTitle.innerText = 'Tambah Layanan Baru';
    renderServicesForKasir();
}

function renderServicesForKasir() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const fallbackServices = [
        { firebaseKey: '1', id: 1, name: 'Cuci Kiloan Reguler', price: 7000, unit: 'kg' },
        { firebaseKey: '2', id: 2, name: 'Cuci + Setrika', price: 10000, unit: 'kg' },
        { firebaseKey: '3', id: 3, name: 'Setrika Saja', price: 5000, unit: 'kg' },
        { firebaseKey: '4', id: 4, name: 'Cuci Selimut / Bedcover', price: 25000, unit: 'pcs' }
    ];

    const servicesToRender = dbServices.length > 0 ? dbServices : fallbackServices;

    servicesToRender.forEach(s => {
        const isSelected = selectedServiceForOrder && selectedServiceForOrder.firebaseKey === s.firebaseKey;
        grid.innerHTML += `
            <div onclick="selectServiceForOrder('${s.firebaseKey}')" class="p-3 rounded-xl border cursor-pointer transition ${isSelected ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}">
                <p class="font-bold text-xs text-slate-800 truncate">${s.name}</p>
                <p class="text-xs font-semibold text-blue-600 mt-1">Rp ${s.price.toLocaleString()} <span class="text-[10px] text-slate-500">/${s.unit}</span></p>
            </div>
        `;
    });
}

function selectServiceForOrder(firebaseKey) {
    const fallbackServices = [
        { firebaseKey: '1', id: 1, name: 'Cuci Kiloan Reguler', price: 7000, unit: 'kg' },
        { firebaseKey: '2', id: 2, name: 'Cuci + Setrika', price: 10000, unit: 'kg' },
        { firebaseKey: '3', id: 3, name: 'Setrika Saja', price: 5000, unit: 'kg' },
        { firebaseKey: '4', id: 4, name: 'Cuci Selimut / Bedcover', price: 25000, unit: 'pcs' }
    ];
    const pool = dbServices.length > 0 ? dbServices : fallbackServices;
    selectedServiceForOrder = pool.find(s => s.firebaseKey === firebaseKey);
    renderServicesForKasir();
}

function renderServicesManageList() {
    const container = document.getElementById('services-manage-list');
    if(!container) return;
    container.innerHTML = '';

    dbServices.forEach(s => {
        container.innerHTML += `
            <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                    <p class="font-bold text-slate-700">${s.name}</p>
                    <p class="text-slate-500 text-[11px]">Rp ${s.price.toLocaleString()} / ${s.unit}</p>
                </div>
                <div class="space-x-1">
                    <button onclick="editService('${s.firebaseKey}')" class="px-2 py-1 bg-amber-500 text-white rounded"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteService('${s.firebaseKey}')" class="px-2 py-1 bg-red-500 text-white rounded"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

function saveService(e) {
    e.preventDefault();
    const firebaseKey = document.getElementById('serv-id').value;
    const name = document.getElementById('serv-name').value.trim();
    const price = Number(document.getElementById('serv-price').value);
    const unit = document.getElementById('serv-unit').value.trim();

    if (firebaseKey) {
        if (confirm('Konfirmasi: Simpan perubahan layanan ini?')) {
            window.dbUpdate(window.dbRef(window.db, 'services/' + firebaseKey), { name, price, unit })
                .then(() => {
                    alert('Layanan berhasil diperbarui!');
                    closeServicesModal();
                });
        }
    } else {
        if (confirm(`Konfirmasi: Tambah layanan baru "${name}"?`)) {
            const newId = Date.now();
            window.dbSet(window.dbRef(window.db, 'services/' + newId), { id: newId, name, price, unit })
                .then(() => {
                    alert('Layanan baru berhasil ditambahkan!');
                    closeServicesModal();
                });
        }
    }
}

function editService(firebaseKey) {
    const s = dbServices.find(item => item.firebaseKey === firebaseKey);
    if (s) {
        document.getElementById('serv-id').value = s.firebaseKey;
        document.getElementById('serv-name').value = s.name;
        document.getElementById('serv-price').value = s.price;
        document.getElementById('serv-unit').value = s.unit;
        document.getElementById('service-form-title').innerText = 'Edit Layanan';
    }
}

function deleteService(firebaseKey) {
    if (confirm('Konfirmasi: Hapus layanan ini?')) {
        window.dbRemove(window.dbRef(window.db, 'services/' + firebaseKey));
    }
}

function addToCart() {
    if (!selectedServiceForOrder) {
        alert('Silakan pilih jenis layanan terlebih dahulu!');
        return;
    }
    const qtyInput = document.getElementById('input-qty');
    const qty = parseFloat(qtyInput.value);
    if (!qty || qty <= 0) {
        alert('Masukkan berat atau jumlah yang valid!');
        return;
    }

    const existingIndex = cart.findIndex(item => item.serviceId === selectedServiceForOrder.id);
    if (existingIndex > -1) {
        cart[existingIndex].qty += qty;
        cart[existingIndex].subtotal = cart[existingIndex].qty * cart[existingIndex].price;
    } else {
        cart.push({
            serviceId: selectedServiceForOrder.id || 1,
            name: selectedServiceForOrder.name,
            price: selectedServiceForOrder.price,
            unit: selectedServiceForOrder.unit,
            qty: qty,
            subtotal: qty * selectedServiceForOrder.price
        });
    }

    renderCart();
    qtyInput.value = '1';
}

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Keranjang masih kosong</p>`;
        document.getElementById('cart-total-qty').innerText = '0';
        document.getElementById('cart-total-price').innerText = 'Rp 0';
        return;
    }

    let totalQty = 0;
    let totalPrice = 0;

    cart.forEach((item, index) => {
        totalQty += item.qty;
        totalPrice += item.subtotal;
        container.innerHTML += `
            <div class="py-2 flex justify-between items-center text-xs">
                <div>
                    <p class="font-bold text-slate-800">${item.name}</p>
                    <p class="text-[10px] text-slate-500">${item.qty} ${item.unit} x Rp ${item.price.toLocaleString()}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-blue-600">Rp ${item.subtotal.toLocaleString()}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash text-[11px]"></i></button>
                </div>
            </div>
        `;
    });

    document.getElementById('cart-total-qty').innerText = totalQty;
    document.getElementById('cart-total-price').innerText = `Rp ${totalPrice.toLocaleString()}`;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCart();
}

function clearCart() {
    if (cart.length > 0 && confirm('Kosongkan keranjang pesanan?')) {
        cart = [];
        renderCart();
    }
}

function processCheckout() {
    if (!selectedCustomer) {
        alert('Silakan pilih pelanggan terlebih dahulu!');
        return;
    }
    if (cart.length === 0) {
        alert('Keranjang pesanan masih kosong!');
        return;
    }

    if (!confirm('Proses pesanan dan cetak struk pembayaran?')) {
        return;
    }

    const transactionId = 'SL-' + Date.now().toString().slice(-6);
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID');
    
    let totalPrice = cart.reduce((acc, item) => acc + item.subtotal, 0);

    const transaction = {
        id: transactionId,
        date: dateStr,
        cashier: currentUser,
        customer: selectedCustomer.name,
        phone: selectedCustomer.phone,
        items: [...cart],
        total: totalPrice
    };

    window.dbSet(window.dbRef(window.db, 'transactions/' + transactionId), transaction)
        .then(() => {
            document.getElementById('receipt-id').innerText = transactionId;
            document.getElementById('receipt-date').innerText = dateStr;
            document.getElementById('receipt-cashier').innerText = currentUser;
            document.getElementById('receipt-customer').innerText = selectedCustomer.name;
            document.getElementById('receipt-total').innerText = `Rp ${totalPrice.toLocaleString()}`;

            const receiptItemsContainer = document.getElementById('receipt-items-list');
            receiptItemsContainer.innerHTML = '';
            cart.forEach(item => {
                receiptItemsContainer.innerHTML += `
                    <div class="flex justify-between">
                        <span>${item.name} (${item.qty}${item.unit})</span>
                        <span>Rp ${item.subtotal.toLocaleString()}</span>
                    </div>
                `;
            });

            window.print();

            cart = [];
            selectedCustomer = null;
            document.getElementById('selected-customer-info').classList.add('hidden');
            renderCart();
        });
}

function renderTransactionHistory() {
    const container = document.getElementById('history-list-container');
    if (!container) return;
    const countEl = document.getElementById('total-transaksi-count');
    if(countEl) countEl.innerText = `${dbTransactions.length} Transaksi`;
    container.innerHTML = '';

    if (dbTransactions.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Belum ada riwayat transaksi</p>`;
        return;
    }

    dbTransactions.forEach(t => {
        let itemsHtml = t.items ? t.items.map(i => `<div class="text-[11px] text-slate-600">- ${i.name} (${i.qty} ${i.unit}) : Rp ${i.subtotal.toLocaleString()}</div>`).join('') : '';
        container.innerHTML += `
            <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div class="flex justify-between items-center border-b pb-1.5">
                    <span class="font-bold text-xs text-blue-600">${t.id}</span>
                    <span class="text-[10px] text-slate-400">${t.date}</span>
                </div>
                <div class="text-xs space-y-0.5">
                    <p><span class="font-semibold text-slate-700">Pelanggan:</span> ${t.customer} (${t.phone})</p>
                    <p><span class="font-semibold text-slate-700">Kasir:</span> ${t.cashier}</p>
                </div>
                <div class="bg-slate-50 p-2 rounded-xl space-y-1">
                    ${itemsHtml}
                </div>
                <div class="flex justify-between items-center pt-1">
                    <span class="text-xs font-bold text-slate-800">Total: Rp ${t.total.toLocaleString()}</span>
                    <button onclick="reprintTransaction('${t.id}')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold">
                        <i class="fa-solid fa-print mr-1"></i> Cetak Ulang
                    </button>
                </div>
            </div>
        `;
    });
}

function reprintTransaction(id) {
    const t = dbTransactions.find(item => item.id === id);
    if (!t) return;

    document.getElementById('receipt-id').innerText = t.id;
    document.getElementById('receipt-date').innerText = t.date;
    document.getElementById('receipt-cashier').innerText = t.cashier;
    document.getElementById('receipt-customer').innerText = t.customer;
    document.getElementById('receipt-total').innerText = `Rp ${t.total.toLocaleString()}`;

    const receiptItemsContainer = document.getElementById('receipt-items-list');
    receiptItemsContainer.innerHTML = '';
    t.items.forEach(item => {
        receiptItemsContainer.innerHTML += `
            <div class="flex justify-between">
                <span>${item.name} (${item.qty}${item.unit})</span>
                <span>Rp ${item.subtotal.toLocaleString()}</span>
            </div>
        `;
    });

    window.print();
}
