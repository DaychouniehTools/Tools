# Daychounieh Tools

Daychounieh Tools has a public shop homepage and a separate private product catalogue. The private catalogue uses Supabase email/password sign-in, customer accounts created by shop owners, access logs, and owner-controlled blocking. Keep the local inventory importer and the public GitHub Pages deployment separate from private product data.

## Start the project

Keep the public files (`index.html`, `private-catalog.html`, `private-catalog-config.js`, `service-worker.js`, and `.nojekyll`) at the repository root. The Pages workflow copies only these approved public files into its deployment artifact.

Use the GitHub repository folder in both Visual Studio Code and GitHub Desktop. The Desktop `Test` folder is a link to this repository folder:

1. In GitHub Desktop, open `Desktop\Test` (the folder containing `.git`).
2. In Visual Studio Code, open that same repository folder.
3. Keep the separate import-working copy at `Desktop\Daychounieh-Local-Project`. Use it for local inventory preparation; do not copy its catalog or product photos into the public GitHub repository.
4. Put local workbooks in `imports/workbooks/` and source product photos in `imports/photos/`.
5. Review website code/config changes in GitHub Desktop, then commit and push those public-site changes. Never commit or push private inventory or product photos.

The local-only `admin-import.html` importer is excluded from Git. For Excel/photo imports, double-click `Start Local Importer.bat` and open `http://127.0.0.1:8765/`. Use `Start POS Importer.bat` when you also need QuickBooks POS stock access. Alternatively, run the **Start local Excel importer** task from VS Code.

## Website

The current live shop is at `https://daychouniehtools.github.io/Tools/`. After the repository is renamed, the planned address is `https://daychouniehtools.github.io/Daychounieh-Tools/`. The public homepage does not load `catalog.js` or publish product images. Customers use `private-catalog.html` for password-protected product information.

### Configure private customer access

The private catalogue is not active until Supabase is configured and the database migration and Edge Function are deployed. Do not send passwords or the Supabase service-role key in chat or commit them to Git.

1. Create a Supabase project. Under **Authentication → Sign In / Providers**, disable public user sign-ups so only shop owners can create customer accounts through the private owner page. Google OAuth is not needed for this email/password flow.
2. Add the project URL and publishable/anon key to `private-catalog-config.js`. These browser values are public; never put a service-role key there.
3. In **Authentication → Users**, create each owner account or set a password for an existing owner account. The configured owner emails are `libanabil9@gmail.com`, `bejjani.nabil@gmail.com`, and `abboud.amale@gmail.com`. Each owner signs in to the private catalogue with their email and password.
4. Set the Supabase Edge Function secret `ADMIN_EMAILS` to the comma-separated owner email addresses and `ALLOWED_ORIGIN` to the deployed site's origin (for the current site, `https://daychouniehtools.github.io`). Keep the service-role key only in the function's Supabase runtime environment.
5. With the Supabase CLI installed and authenticated, run these commands from the repository folder, replacing the project reference with your Supabase project ref:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase migration list
   supabase db push --dry-run
   supabase db push
   supabase secrets set 'ADMIN_EMAILS=libanabil9@gmail.com,bejjani.nabil@gmail.com,abboud.amale@gmail.com' 'ALLOWED_ORIGIN=https://daychouniehtools.github.io'
   supabase functions deploy private-catalog --project-ref YOUR_PROJECT_REF
   ```

   Review the migration list and dry-run before applying changes, including the migration timestamps and ordering; stop if anything unexpected is pending. The migrations create private product/access tables, a private image bucket, a three-customer-session limit, and a scheduled purge for IP access logs older than 24 hours. Supabase supplies the function's backend keys at runtime; never copy the service-role key into the website.
6. Configure GitHub Pages with the repository's Pages workflow. It deploys only the public homepage, private-catalog page/config, and service worker; it does not deploy `catalog.js` or `images/`.
7. Open the deployed private catalogue and sign in as an owner. Create customer accounts with an email address and temporary password, choose access duration in hours or days, and share the credentials privately. The account's access period starts when you create or renew it. Up to three customer browser sessions can use the catalogue at once; owner sessions do not count. Use the owner screen to block/unblock accounts and review access logs. To publish products, sign in as an owner in the local importer and choose **Upload latest local catalog for customers**; it uploads the selected local project's `catalog.js` and its referenced photos directly to the private backend. Customers only receive products with a positive inventory quantity and at least one available private photo; products with missing/zero/negative stock or no available photo are omitted. All configured owners have the same management powers; an owner cannot create a customer account for or block another owner.

The shop records the account name, email, and IP address when an owner or customer accesses the private catalogue. The owner access log identifies whether each entry is an owner or customer and shows the account email; IP addresses and account details are personal data. Keep the privacy notice visible, review applicable local privacy requirements, and do not use IP records for purposes users have not been told about. The backend removes IP access-log rows after 24 hours.

**Important public-repository limitation:** the deployment workflow excludes inventory files from the live Pages artifact, but any product data or photos already committed to a public GitHub repository may still be available through the repository or its history. Making the Pages output private does not undo previous disclosure. Do not push private inventory or product photos to GitHub; review repository visibility/history before treating existing files as confidential.

### Browse the shop offline

The public homepage can be cached for offline display after it is opened online once. The private catalogue requires an internet connection for password sign-in and access checks; private product images use short-lived access links and are not available offline.

After signing in to the private catalogue on a phone, choose **Take or choose a photo** to search visually across the product photos. The browser compares the photo on the device and does not upload it; results are approximate closest matches, not guaranteed identification. Comparing the catalogue photos requires internet and may use mobile data.

Generate and verify a new QR code after the GitHub Pages address changes. The homepage displays the shop contact number prominently; its number link starts a phone call, and the WhatsApp button opens a chat.

## Import products locally

The local importer reads the workbook in your browser and writes the updated catalog and matching photos to a local project folder you choose. After importing, sign in as a shop owner in the same importer and explicitly upload the latest local catalog for email/password customers. The upload replaces the private online catalog and sends only referenced product photos to Supabase; it does not publish them to GitHub. Do not publish `admin-import.html` or push the generated `catalog.js` or product photos to a public repository.

### QuickBooks POS v9

On the Windows computer with QuickBooks POS installed, log in to POS and double-click `Start POS Importer.bat`. Keep `inventory-sync/pos_importer.py` with the launcher. The connector requires 32-bit Python and `pywin32`; if prompted, install the module with `py -3-32 -m pip install pywin32`. Keep the connector window open. In the local importer, read the POS items, then review and confirm the local catalog update. QuickBooks POS currently supplies item codes and stock quantities only: the connector does not read the POS picture tick or download POS pictures. Picture cleanup checks image URLs and files in the selected local project's `images/` folder. Inventory changes stay local until uploaded through the private owner screen; never publish them through GitHub Desktop.

1. Start the local importer with `Start Local Importer.bat` and open `http://127.0.0.1:8765/` in a recent version of Chrome or Edge. Use `Start POS Importer.bat` instead when you also need QuickBooks POS stock access.
2. Click **Select Excel file** and choose your inventory workbook (`.xlsx`/`.xls`) or CSV file. This only selects the workbook; it does not import it yet.
3. Optionally click **Choose photos folder** and select the folder with product photos. Name the main photo after its item code, such as `290.jpg` or `290_Def.jpg`. For an optional second photo, name it `290_2.jpg` or `290_Alt.jpg`; product details show both photos with previous/next controls. JPG, PNG, WebP, and GIF files are supported.
4. Click **Preview and import workbook**. The workbook replaces the local product list: only rows with positive numeric `Qty 1` and a non-empty `Item Name` are included. A blank name or the literal placeholder `empty` is skipped, and a previously listed product absent from the eligible workbook rows is removed. A completely blank workbook or one with only headers is allowed; after a clear confirmation, it removes every product from the local catalog while leaving photos in place. The previous local catalog is backed up under `imports/backups/`.
5. Check the updated local storefront. To make the same items visible to email/password customers, sign in as a shop owner in the importer, choose **Upload latest local catalog for customers**, and confirm the replacement. The importer sends the selected local `catalog.js` and only its referenced photos directly to the private backend. Do not use GitHub Desktop to publish inventory data or product photos.

To remove all items without choosing a workbook, choose the local project folder and click **Delete all items**. Confirm the prompt; the old catalog is backed up and product image files are not deleted. To remove items from the private live catalogue, use the importer’s owner-only publish action after clearing the local catalog.

To remove every catalog item that has no usable local or web picture, click **Remove items without pictures** next to the import button. The tool checks all catalog items against existing files in the project's `images/` folder and valid web image URLs, shows a confirmation with the number to remove, and leaves all image files untouched. Back up the project before confirming; removing catalog items cannot be undone by the importer.

The workbook's `Size` column is imported and shown on product cards and in product details. You can also add optional `Dimensions` and `Sizes` (or `Variants`) columns to show physical measurements separately from choices such as S/M/L. For example, `Dimensions` can contain `20 x 15 x 8 cm`, and `Sizes` can contain `Small, Medium, Large`. Search also matches these fields.

Excel's `_x000D_` marker in text fields represents a carriage return/line break. The importer converts it to a normal line break instead of showing the marker in the product description.

For the QuickBooks inventory export, the importer uses only the website fields: `Item Number` (item code), `Item Name`, `Web Price`, `Qty 1` (availability filter), `Size`, `Department Name` (category), `Attribute`, `Item Description` (or `Brief Description` if the item description is empty), `UPC` (barcode), and `Web keywords`. `Qty 1` is required. The imported catalog is replaced with eligible workbook rows: products omitted from the workbook and rows whose quantity is zero, negative, blank, or nonnumeric are removed from the catalog; their photo files are not deleted. English field values are kept as entered in the workbook; the importer does not translate categories, colors, sizes, names, or descriptions. Optional Arabic columns are only used when they contain Arabic text supplied in the workbook. A blank cell clears the old value. Import stops rather than silently skipping rows with missing item codes or duplicate item codes. Product images are matched from the selected photo folder by item code. Accounting, cost, reorder, and other back-office columns are ignored.

The storefront displays the workbook's original English and any Arabic text contained in its fields; it automatically handles mixed text direction. The importer repairs common Arabic mojibake while leaving English words unchanged. Optional `Arabic Item Name`, `Arabic Description`, `Arabic Category`, `Arabic Size`, `Arabic Attribute`, and `Arabic Dimensions` columns can provide Arabic text, which is added only when explicitly supplied. Existing Arabic translations are not copied over workbook values.

The browser fetches the Excel-reading library from jsDelivr when opening the importer for `.xls`/`.xlsx` workbooks; the spreadsheet and photos stay on your computer and are not sent to that service. CSV import uses the browser directly. Keep a backup of the project folder before importing.

Arabic text in legacy `.xls` files is read using the Arabic Windows code page. CSV files are decoded as UTF-8 (including UTF-8/UTF-16 byte-order-mark files) or Arabic Windows-1256 when needed. The importer also repairs common Arabic text that was mistakenly decoded as Western Windows-1252. Check Arabic in the local preview before confirming; if it is still incorrect, stop and save the workbook as `.xlsx` or UTF-8 CSV.

Workbook text is used as written; a blank description clears the previous description unless a `Brief Description` or an explicit `Arabic Description` value is supplied. Review the local catalog before publishing.

The local importer is excluded from the public GitHub repository by `.gitignore`. If you move the project to another computer, copy `admin-import.html` there separately if you need the import tool.

## Catalog and orders

Prices are displayed in USD. WhatsApp order requests are sent to `+9613032791`; change `WHATSAPP_NUMBER` in `index.html` to change the shop contact. Customers review and send the prepared order themselves. The site does not process card payments or automatically reserve stock.

The public site, product names, prices, item codes, and photos are visible to visitors. The local importer can only modify files after you open it on your computer and grant access to the project folder; it is not an online admin login.

## GitHub Pages

GitHub Pages publishes only the explicitly selected public files in `.github/workflows/static.yml`. `catalog.js` and `images/` are deliberately excluded from the Pages artifact. Product data and product photos belong in the private Supabase database/storage and should never be pushed to a public repository.
