// ============================================
// OPALCREST ADMIN — product management
// ============================================

const auth = firebase.auth();
const NGN = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

let editingId = null; // set when the form is in "edit" mode

// ---------- Auth state ----------
auth.onAuthStateChanged(user => {
  document.getElementById("loginSection").style.display = user ? "none" : "block";
  document.getElementById("dashboard").style.display = user ? "block" : "none";
  document.getElementById("logoutBtn").style.display = user ? "inline-flex" : "none";
  if (user) watchProducts();
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.style.display = "none";
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errEl.textContent = "Couldn't sign in — check the email and password.";
    errEl.style.display = "block";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => auth.signOut());

// ---------- Live product list ----------
function watchProducts() {
  db.collection("products").orderBy("name").onSnapshot(snapshot => {
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderAdminList(products);
  });
}

function renderAdminList(products) {
  document.getElementById("productCount").textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;
  const list = document.getElementById("adminProductList");

  if (products.length === 0) {
    list.innerHTML = `<p style="color:var(--ink-soft);">No products yet — add your first one above.</p>`;
    return;
  }

  list.innerHTML = products.map(p => `
    <div style="display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid var(--line);">
      <img src="${p.image}" alt="${p.name}" style="width:52px; height:52px; object-fit:cover; border-radius:var(--radius); background:var(--pearl-dim);">
      <div style="flex:1;">
        <div style="font-weight:600; font-size:0.95rem;">${p.name}</div>
        <div style="font-size:0.8rem; color:var(--ink-soft);">${p.category} · ${NGN.format(p.price)} · stock ${p.stock}</div>
      </div>
      <button class="btn btn-ghost" data-action="edit" data-id="${p.id}" style="color:var(--ink); border-color:var(--line); padding:7px 14px; font-size:0.8rem;">Edit</button>
      <button class="btn btn-ghost" data-action="delete" data-id="${p.id}" style="color:var(--danger); border-color:var(--line); padding:7px 14px; font-size:0.8rem;">Delete</button>
    </div>
  `).join("");

  list.querySelectorAll("[data-action='edit']").forEach(btn =>
    btn.addEventListener("click", () => startEdit(btn.dataset.id, products))
  );
  list.querySelectorAll("[data-action='delete']").forEach(btn =>
    btn.addEventListener("click", () => deleteProduct(btn.dataset.id, btn))
  );
}

// ---------- Add / edit form ----------
const form = document.getElementById("productForm");

form.addEventListener("submit", async e => {
  e.preventDefault();
  const data = {
    name: document.getElementById("pName").value.trim(),
    category: document.getElementById("pCategory").value.trim(),
    price: Number(document.getElementById("pPrice").value),
    stock: Number(document.getElementById("pStock").value),
    image: document.getElementById("pImage").value.trim(),
    description: document.getElementById("pDescription").value.trim(),
  };

  const status = document.getElementById("formStatus");
  status.textContent = "Saving…";

  try {
    if (editingId) {
      await db.collection("products").doc(editingId).update(data);
      status.textContent = "Updated.";
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("products").add(data);
      status.textContent = "Added.";
    }
    resetForm();
  } catch (err) {
    console.error(err);
    status.textContent = "Something went wrong — check Firestore rules.";
  }
  setTimeout(() => (status.textContent = ""), 2500);
});

function startEdit(id, products) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById("pName").value = p.name;
  document.getElementById("pCategory").value = p.category;
  document.getElementById("pPrice").value = p.price;
  document.getElementById("pStock").value = p.stock;
  document.getElementById("pImage").value = p.image;
  document.getElementById("pDescription").value = p.description;
  document.getElementById("formTitle").textContent = "Edit product";
  document.getElementById("submitBtn").textContent = "Save changes";
  document.getElementById("cancelEditBtn").style.display = "inline-flex";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById("formTitle").textContent = "Add a product";
  document.getElementById("submitBtn").textContent = "Add product";
  document.getElementById("cancelEditBtn").style.display = "none";
}

document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

async function deleteProduct(id, btn) {
  if (!confirm("Delete this product? This can't be undone.")) return;
  btn.textContent = "Deleting…";
  try {
    await db.collection("products").doc(id).delete();
  } catch (err) {
    console.error(err);
    alert("Couldn't delete — check Firestore rules.");
    btn.textContent = "Delete";
  }
}

// ---------- Bulk import ----------
document.getElementById("bulkImportBtn").addEventListener("click", async () => {
  const status = document.getElementById("bulkStatus");
  let items;
  try {
    items = JSON.parse(document.getElementById("bulkJson").value);
    if (!Array.isArray(items)) throw new Error("not an array");
  } catch (err) {
    status.textContent = "That's not valid JSON — check the format.";
    status.style.color = "var(--danger)";
    return;
  }

  status.textContent = `Importing ${items.length} item(s)…`;
  status.style.color = "var(--ink-soft)";

  try {
    const batch = db.batch();
    items.forEach(item => {
      const ref = db.collection("products").doc();
      batch.set(ref, {
        name: item.name || "Untitled",
        category: item.category || "Uncategorised",
        price: Number(item.price) || 0,
        stock: Number(item.stock) || 0,
        image: item.image || "",
        description: item.description || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    status.textContent = `Imported ${items.length} item(s).`;
    document.getElementById("bulkJson").value = "";
  } catch (err) {
    console.error(err);
    status.textContent = "Import failed — check Firestore rules.";
    status.style.color = "var(--danger)";
  }
});

// ---------- Toast (shared pattern with storefront, unused for now but here if needed) ----------
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2400);
}
