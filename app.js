// ============================================
// OPALCREST ENTERPRISE — storefront logic
// ============================================

// ⚠️ Replace with your real Paystack PUBLIC key (starts with pk_).
// Never put your SECRET key in frontend code.
const PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_ME";

const NGN = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

let PRODUCTS = [];
let cart = JSON.parse(localStorage.getItem("opalcrest_cart") || "{}"); // { productId: qty }
let activeCategory = "all";

// ---------- Load products ----------
async function loadProducts() {
  try {
    const res = await fetch("products.json");
    PRODUCTS = await res.json();
  } catch (err) {
    console.error("Could not load products.json", err);
    PRODUCTS = [];
  }
  buildCategoryNav();
  renderProducts();
  renderCart();
}

function buildCategoryNav() {
  const nav = document.getElementById("categoryNav");
  const cats = ["all", ...new Set(PRODUCTS.map(p => p.category))];
  nav.innerHTML = cats.map(c =>
    `<button data-category="${c}" class="${c === "all" ? "active" : ""}">${c === "all" ? "All" : c}</button>`
  ).join("");
  nav.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      nav.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts();
    });
  });
}

// ---------- Render product grid ----------
function renderProducts() {
  const grid = document.getElementById("productGrid");
  const list = activeCategory === "all" ? PRODUCTS : PRODUCTS.filter(p => p.category === activeCategory);
  document.getElementById("resultCount").textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    grid.innerHTML = `<p style="color:var(--ink-soft);">No items in this category yet.</p>`;
    return;
  }

  grid.innerHTML = list.map(p => `
    <div class="product-card">
      <div class="thumb"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="product-body">
        <span class="product-category">${p.category}</span>
        <h3>${p.name}</h3>
        <p class="desc">${p.description}</p>
        ${p.stock <= 3 ? `<span class="stock-low">Only ${p.stock} left</span>` : ""}
        <div class="product-footer">
          <span class="price">${NGN.format(p.price)}</span>
          <button class="add-btn" data-id="${p.id}">Add to cart</button>
        </div>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });
}

// ---------- Cart ----------
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  renderCart();
  showToast("Added to cart");
}

function updateQty(id, delta) {
  if (!cart[id]) return;
  cart[id] += delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
  renderCart();
}

function removeFromCart(id) {
  delete cart[id];
  saveCart();
  renderCart();
}

function saveCart() {
  localStorage.setItem("opalcrest_cart", JSON.stringify(cart));
}

function cartLines() {
  return Object.entries(cart)
    .map(([id, qty]) => ({ product: PRODUCTS.find(p => p.id === id), qty }))
    .filter(line => line.product);
}

function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.product.price * l.qty, 0);
}

function renderCart() {
  const itemsEl = document.getElementById("cartItems");
  const lines = cartLines();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartTotal").textContent = NGN.format(cartTotal());
  document.getElementById("checkoutBtn").disabled = lines.length === 0;

  if (lines.length === 0) {
    itemsEl.innerHTML = `<div class="empty-cart">Your cart is empty.</div>`;
    return;
  }

  itemsEl.innerHTML = lines.map(({ product, qty }) => `
    <div class="cart-line">
      <img src="${product.image}" alt="${product.name}">
      <div class="cart-line-info">
        <h4>${product.name}</h4>
        <span class="price">${NGN.format(product.price)}</span>
        <div class="qty-row">
          <button data-action="dec" data-id="${product.id}">−</button>
          <span>${qty}</span>
          <button data-action="inc" data-id="${product.id}">+</button>
        </div>
        <button class="remove-line" data-action="remove" data-id="${product.id}">Remove</button>
      </div>
    </div>
  `).join("");

  itemsEl.querySelectorAll("[data-action]").forEach(btn => {
    const id = btn.dataset.id;
    if (btn.dataset.action === "inc") btn.addEventListener("click", () => updateQty(id, 1));
    if (btn.dataset.action === "dec") btn.addEventListener("click", () => updateQty(id, -1));
    if (btn.dataset.action === "remove") btn.addEventListener("click", () => removeFromCart(id));
  });
}

// ---------- Cart drawer open/close ----------
const cartOverlay = document.getElementById("cartOverlay");
const cartDrawer = document.getElementById("cartDrawer");

function openCart() { cartOverlay.classList.add("open"); cartDrawer.classList.add("open"); }
function closeCartFn() { cartOverlay.classList.remove("open"); cartDrawer.classList.remove("open"); }

document.getElementById("openCart").addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCartFn);
cartOverlay.addEventListener("click", closeCartFn);

// ---------- Checkout modal ----------
const checkoutOverlay = document.getElementById("checkoutOverlay");
document.getElementById("checkoutBtn").addEventListener("click", () => {
  document.getElementById("payAmount").textContent = NGN.format(cartTotal());
  document.getElementById("checkoutForm").style.display = "block";
  document.getElementById("orderSuccess").style.display = "none";
  checkoutOverlay.classList.add("open");
});
document.getElementById("closeModal").addEventListener("click", () => checkoutOverlay.classList.remove("open"));

document.getElementById("payBtn").addEventListener("click", handlePayment);

function handlePayment() {
  const name = document.getElementById("custName").value.trim();
  const email = document.getElementById("custEmail").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();

  if (!name || !email || !phone || !address) {
    showToast("Please fill in all delivery details");
    return;
  }
  if (PAYSTACK_PUBLIC_KEY.includes("REPLACE_ME")) {
    showToast("Add your Paystack public key in app.js first");
    return;
  }

  const amountKobo = Math.round(cartTotal() * 100); // Paystack expects kobo

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: amountKobo,
    currency: "NGN",
    ref: "OPC-" + Date.now(),
    metadata: {
      custom_fields: [
        { display_name: "Customer Name", variable_name: "customer_name", value: name },
        { display_name: "Phone", variable_name: "phone", value: phone }
      ]
    },
    callback: function (response) {
      saveOrder({ name, email, phone, address, reference: response.reference, amount: cartTotal(), lines: cartLines() });
    },
    onClose: function () {
      showToast("Payment cancelled");
    }
  });
  handler.openIframe();
}

async function saveOrder(order) {
  try {
    await db.collection("orders").add({
      ...order,
      lines: order.lines.map(l => ({ id: l.product.id, name: l.product.name, qty: l.qty, price: l.product.price })),
      status: "paid",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Order failed to save to Firestore", err);
    // Payment already succeeded on Paystack's side even if this write fails —
    // consider also emailing yourself or logging to a backup sheet.
  }

  document.getElementById("orderRef").textContent = order.reference;
  document.getElementById("checkoutForm").style.display = "none";
  document.getElementById("orderSuccess").style.display = "block";

  cart = {};
  saveCart();
  renderCart();
}

document.getElementById("continueShopping").addEventListener("click", () => {
  checkoutOverlay.classList.remove("open");
  closeCartFn();
});

// ---------- Toast ----------
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

// ---------- Init ----------
document.getElementById("year").textContent = new Date().getFullYear();
loadProducts();
