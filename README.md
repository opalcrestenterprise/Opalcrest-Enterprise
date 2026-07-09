[README.md](https://github.com/user-attachments/files/29846714/README.md)
# Opalcrest Enterprise — Online Store

A static storefront: product grid, cart, and checkout via **Paystack** (cards, bank transfer, USSD), with products and orders both stored in **Firebase Firestore**. Products are managed through a built-in **admin page** — no code editing needed to add, edit, or remove items. No backend server required — deployable straight to GitHub Pages.

## What's in here
- `index.html` — the storefront
- `admin.html` / `admin.js` — password-protected page for managing products
- `styles.css` — design system (the gradient "facet" edge is the one signature flourish, sampled from your logo's blue → violet → pink spectrum)
- `app.js` — cart logic, rendering, Paystack + Firestore integration
- `products.json` — sample product shape, handy as a reference or for the admin page's bulk-import box (no longer read directly by the site)
- `firebase-config.js` — your Firebase project keys go here
- `assets/` — your logo files

## 1. Set up Firebase
You've done this before with the check-in app — same flow:
1. [Firebase Console](https://console.firebase.google.com) → your existing project, or create a new one for the store.
2. Project Settings → General → "Your apps" → add a Web app → copy the config object into `firebase-config.js`.
3. Build → Firestore Database → create database (production mode).
4. Build → Authentication → Sign-in method → enable **Email/Password**.
5. Authentication → Users → **Add user** → this is your admin login (use a real email you check, and a strong password). This is the only account that can manage products — there's no public sign-up.

### Firestore rules
Products should be publicly readable (so the store works) but only writable by your signed-in admin account. Orders should be create-only for customers, and not publicly readable. Paste this under Firestore Database → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{orderId} {
      allow create: if true;
      allow read, update, delete: if false;
    }
  }
}
```

### Restrict your API key
Same as the check-in app: in Google Cloud Console → Credentials, restrict the browser key to your GitHub Pages domain once you're live.

## 2. Add your products
Open `admin.html` in the browser (locally or once deployed), sign in with the admin account you created above, and:
- Fill in the **Add a product** form for one-off additions — it appears on the storefront immediately.
- Or use **Advanced: bulk import from JSON** to paste an array in the same shape as `products.json` and add several at once (handy for the first batch).
- Click **Edit** or **Delete** on any product in the list below to change it.

Categories in the storefront's nav bar are generated automatically from whatever category names you use — no extra step needed.

**Keep `admin.html` off public listings.** It's not linked from the storefront and has a `noindex` tag, but it isn't hidden by a server — anyone with the URL sees the login screen. The Firestore rules above are what actually stop unauthorized writes, since only your Auth account can pass `request.auth != null`.

## 3. Set up Paystack (payment)
1. Create an account at [paystack.com](https://paystack.com) and complete business verification (needed before you can go live).
2. Settings → API Keys & Webhooks → copy your **Public Key**.
3. Paste it into `app.js`:
   ```js
   const PAYSTACK_PUBLIC_KEY = "pk_live_xxxxxxxx"; // or pk_test_xxxx while testing
   ```
4. Use `pk_test_` while testing — Paystack gives you test card numbers in their docs. Switch to `pk_live_` only once you're ready to accept real payments.

**Important:** only the public key belongs in this frontend code. Never put your secret key in any file that goes to GitHub — it's not needed for this simple flow since Paystack Inline handles the payment in the browser.

## 4. Test locally
Because the site talks to Firestore, opening `index.html` directly (`file://`) can run into issues in some browsers. Run a quick local server instead:
```bash
cd opalcrest
python3 -m http.server 8000
```
Then visit `http://localhost:8000` for the store and `http://localhost:8000/admin.html` for the admin page.

## 5. Deploy to GitHub Pages
Same as your check-in app:
1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → set source to your main branch (root).
3. Your store will be live at `https://yourusername.github.io/repo-name/`, and admin at `.../admin.html`.

## Notes on what's *not* included yet
This is a solid starting point, not a full production system. Things worth adding as the business grows:
- **Order confirmation emails** — Paystack can trigger these, or you can add a small Cloud Function that emails on new Firestore order docs.
- **Stock decrementing** — `stock` is a display label right now; it won't auto-reduce after a sale. That needs a small backend/Cloud Function to be race-condition safe.
- **An orders tab in admin** — right now you'd check incoming orders in the Firebase Console directly; a proper orders view could be added the same way the products tab was.
- **Payment verification webhook** — for extra safety, Paystack recommends verifying payment server-side (Cloud Function) rather than trusting the browser callback alone, to guard against tampering.
- **Image uploads** — the admin form takes an image URL rather than a file upload; wiring it to Firebase Storage would let you upload photos directly instead of hosting them elsewhere first.

Happy to help build any of these next.

