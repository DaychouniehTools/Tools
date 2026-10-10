# Nabil

Nabil is a responsive, read-only public storefront with 2,127 searchable items, product photos, category filters, product details, a shopping bag, and WhatsApp order requests. The private importer is kept in `admin-import.html` on your computer and is not part of the public website.

## Open the storefront

Open `index.html` in a modern browser. The full 2,127-item catalog is bundled in `catalog.js`, so products appear without selecting an Excel file. Keep `index.html`, `catalog.js`, and `images/` together when copying Nabil to hosting. Search matches item names and SKUs; the catalog includes the repaired Arabic names.

## Updating products privately

The published `index.html` is a read-only storefront; it has no product-import controls. GitHub Pages is public static hosting, so it cannot securely restrict an importer embedded in the website. Keep `admin-import.html` on your computer and do not copy it to the GitHub repository.

To update the public catalog, open `admin-import.html` in a browser on your computer, select the inventory spreadsheet and optional photo folder, then choose **Prepare updated catalog**. Replace `catalog.js` in the project with the downloaded file. If a photo ZIP is created, extract it into `images/`, replacing files when asked. Commit and push `catalog.js` and the updated images with GitHub Desktop; after Pages deploys, the storefront shows the updated products. The importer runs in your browser and uses the existing `catalog.js` as its starting catalog.

The importer reads the first worksheet and recognizes common column names. It requires:

| Store field | Example column names |
| --- | --- |
| Item code | `SKU`, `Item Code`, `Product Code`, `Item Number` |
| Product name | `Name`, `Product`, `Item`, `Title`, `Description` |
| Price | `Web Price` (preferred), `Price`, `Sale Price`, `Sales Price`, `Unit Price`, `Regular Price`, `Retail Price` |
| Photo URL | `Image URL`, `Photo URL`, `Picture URL`, `Image` |
| Category (optional) | `Category`, `Department`, `Type` |

QuickBooks POS inventory exports are supported: Nabil uses `sku` as the item code, `Item Name` as the product name, and prefers `Web Price` over `Regular Price`. It also repairs the legacy Windows-1256 Arabic text encoding used in this workbook during import/export.

### Importing separate product photos

1. Keep the product photos together in one folder.
2. Photos can be named with the matching item code (`290.jpg`) or the QuickBooks POS pattern (`290_Def.jpg`) for SKU `290`. JPG, PNG, WebP, GIF, and AVIF image files are accepted.
3. Use `admin-import.html` as described above to match the selected spreadsheet and photos, then prepare updated catalog files.

The photo filename must match the SKU (case-insensitive, without the file extension and optional `_Def` suffix). Duplicate or unmatched photo names are skipped. The importer creates a replacement `catalog.js` and, when photos match, a ZIP of those photos so they can be copied into `images/`. The 1,899 existing product photos are already bundled in that folder.

Prices are currently displayed in USD; change the `CURRENCY` value in `index.html` to the store's currency before use.

## Important: online publishing and payments

The bundled storefront displays and searches all 2,127 catalog items. Customers can send a prepared order request to the shop owner on WhatsApp; they must review and send the message themselves. The order request includes selected items, SKUs, quantities, subtotal, customer name, and delivery address. Confirm availability, delivery, and the payment method with the customer before accepting payment. WhatsApp ordering does not charge cards or reserve stock.

The WhatsApp order link is configured for `+9613032791`; change `WHATSAPP_NUMBER` in `index.html` if you want to use a different shop number. You can host the static catalog on a free service such as GitHub Pages with a free `github.io` address. Keep `index.html`, `catalog.js`, `.nojekyll`, and the complete `images/` folder together when you upload the site. A custom domain generally costs money.

Product and image files on a GitHub Pages site are public, which is expected for a storefront. Do not put customer details, passwords, or payment secrets in the published files. Nabil does not take online card payments or store customer orders.

## Free publishing with GitHub Pages

1. Create a GitHub account if you do not already have one, then install the free GitHub Desktop app and sign in.
2. Create a **public** GitHub repository named `nabil` (product names, SKUs, prices, WhatsApp contact, and photos become public website files).
3. In GitHub Desktop, choose **File → Add local repository**, select this Nabil folder, then choose **Publish repository**. If asked, create a repository here first; publish it as public.
4. Publish the project, including `index.html`, `catalog.js`, `.nojekyll`, `README.md`, `.gitignore`, and every file in `images/`. The prepared image folder contains about 105 MB across 1,899 products. Keep `admin-import.html` private; do not add it to the public repository.
5. In the GitHub repository, open **Settings → Pages** and select the configured Pages deployment source.
6. After deployment finishes, open the URL shown in the Pages settings on your phone. It will look like `https://YOUR-USERNAME.github.io/nabil/`.
7. Test product search, a photo, and the WhatsApp order button on your phone before sharing the address.

GitHub Pages is static hosting only: it does not accept card payments or update stock automatically. For custom-domain hosting, the domain registration is separate and usually costs money.
