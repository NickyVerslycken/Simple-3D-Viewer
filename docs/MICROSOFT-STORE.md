# Publishing on the Microsoft Store

The Store gives Windows users a one-click install with **no SmartScreen warning**: Microsoft signs the package for you (free). The
`.exe` / `.msi` installers on the GitHub release stay available for people who prefer them.

Everything that can be prepared in this repository is already done. What is left needs **your Microsoft account**, so it can only be done by you.

| Already prepared | Where |
| --- | --- |
| Store package build (MSIX/AppX, with all file types registered) | `npm run dist:store` → `release/Simple-3D-Viewer-Store.appx` |
| Tile logos | `build/appx/` |
| Listing text, search terms, captions, certification notes | [`store/listing.md`](../store/listing.md) |
| 6 screenshots (1920 × 1080) and the 300 × 300 icon | `store/screenshots/`, `store/assets/` |
| Privacy policy (the Store asks for a link) | [`PRIVACY.md`](../PRIVACY.md) |
| Sample files for the certification testers | [`examples/`](../examples) |

## What you need to do

### Step 1. Create the developer account (free)

1. Go to **<https://storedeveloper.microsoft.com>** and click *Get started for free*. Use this address: other entry points can still show the old,
   paid sign-up.
2. Choose **Individual** or **Company**:
   - *Individual*: for hobby, personal or non-commercial publishing, under your own name.
   - *Company*: for freelancers and businesses who publish apps as part of their work, and for company-owned apps. Needs a D-U-N-S number or
     official business documents. **You cannot change an Individual account into a Company account later**, so decide first (ask your accountant if unsure).
3. Individual: sign in with a personal Microsoft account and verify your identity with a government ID and a selfie on your phone.
4. The name you choose as *publisher display name* is shown to everybody in the Store.

### Step 2. Reserve the app name

1. Open **Partner Center → Apps and games → New product → MSIX or PWA app**.
2. Enter **Simple 3D Viewer** and click *Check availability*, then *Reserve product name*. Names are unique in the Store. If it is taken, reserve a close
   alternative (for example "Simple 3D Model Viewer"). Tell me the final name, or set it in `build.appx.displayName` in `package.json`.

### Step 3. Copy the three identity values

Open your app in Partner Center → **Product management → Product identity**. Copy these three values into `package.json`, section `build.appx`:

| Partner Center field | `package.json` key | Looks like |
| --- | --- | --- |
| Package/Identity/Name | `identityName` | `12345NickyVerslycken.Simple3DViewer` |
| Package/Identity/Publisher | `publisher` | `CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX` |
| Package/Properties/PublisherDisplayName | `publisherDisplayName` | the publisher name you chose in step 1 |

They are not secret (they are visible in the Store), so they can be committed. **Or simply send them to me in the chat** and I will put them in and build the package.

### Step 4. Build the Store package

On Windows (the Windows SDK is needed once: `winget install Microsoft.WindowsSDK.10.0.26100`; it is already installed on your PC):

```bash
npm run dist:store
```

This writes `release/Simple-3D-Viewer-Store.appx`. It refuses to build while the three values are still placeholders. The file is unsigned on purpose
(Microsoft signs it) and cannot be double-clicked to install. **Upload it only to Partner Center, do not add it to the GitHub release.**

### Step 5. Fill in the submission in Partner Center

Open your app → **Start your submission**. All texts to paste are in [`store/listing.md`](../store/listing.md).

1. **Pricing and availability:** Free, all markets, public.
2. **Properties:** category, privacy policy URL, website, support contact, copyright, additional license terms (paste the `LICENSE` text), system requirements.
3. **Age ratings:** answer the questionnaire (all "No", see the listing file).
4. **Packages:** drag in `Simple-3D-Viewer-Store.appx`. Partner Center will ask you to explain the **runFullTrust** capability: use the text in the listing file.
5. **Store listings:** paste the description, features and search terms, upload the 6 screenshots with captions and the 300 × 300 icon.
6. **Submission options → Notes for certification:** paste the text from the listing file.
7. Click **Submit for certification**. Review takes up to three business days. You get an email when it is published or if something must be fixed.

### Step 6. After it is published

- Tell me the Store link (`https://apps.microsoft.com/detail/...`). I will add the "Get it from Microsoft Store" button to the README and the release notes.
- To publish an update: raise `version` in `package.json` (the Store requires a higher version every time), run `npm run dist:store`, and create a new
  submission with the new `.appx`. Keep the GitHub installers on the same version.

## Good to know

- **Licensing:** the Store only shows Microsoft's default license terms if you provide none. You provide your own (PolyForm Shield, in *Additional license
  terms*), so your license stays as it is. You also accept Microsoft's App Developer Agreement and the Store policies. Read them before you submit.
- **Settings and files:** a Store app runs with the same access to the user's files as the installer version. Windows keeps a Store app's saved settings in its own
  data folder, so they are most likely separate from the `.exe` version's settings.
- **Default app:** like the installers, the Store version registers the file types, but Windows lets the user decide what is the default
  ("Open with → Always").
- **First test:** Microsoft's certification is the first real test of the packaged version. The package could not be installed locally because it is unsigned. If
  certification reports a problem, send me the message and I will fix it.
- **Paid apps later:** the Store also supports paid apps, free trials and in-app purchases (add-ons). Microsoft's own payment system takes 15%. Non-game apps may also
  use their own payment system and keep 100%.

## Technical notes

- `scripts/build-store.mjs` finds `MakeAppx.exe` in the installed Windows SDK. The copy that electron-builder downloads does not start on some Windows 11 PCs
  (a side-by-side error), which is why the wrapper sets `ELECTRON_BUILDER_WINDOWS_KITS_PATH`.
- `scripts/check-store-config.mjs` stops the build while `build.appx` still contains `REPLACE`.
- Logos are regenerated from `build/icon.png` with `npm run store:assets`. Screenshots are re-captured with `npm run store:screenshots`.
- The package targets 64-bit Windows 10/11 (`x64`).
