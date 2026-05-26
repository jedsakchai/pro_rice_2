# Community Rice Mill Website

Multi-page rice mill website built with HTML, CSS (Tailwind), and JavaScript, with an Express + MySQL backend.

## Features

- **Home Page**: Hero banner, mill cards gallery, call-to-action sections
- **Milling Request Page**: Form to submit rice milling requests with validation
- **Inquiry Page**: Contact form with social media links
- **Contact Page**: Multiple contact channels, location map, FAQ section
- **Responsive Design**: Works great on mobile (360px+), tablet, and desktop
- **Accessibility**: ARIA labels, keyboard navigation, focus states
- **Mobile Menu**: Sticky header with collapsible mobile navigation

## Tech Stack

- Frontend: HTML5 + Tailwind CSS + Vanilla JavaScript
- Backend: Node.js (Express) + MySQL (MAMP)
- Tooling: PostCSS + Tailwind CLI

## Project Structure

```
rice_2/
├── public/                  # Static site (open/serve this)
│   ├── *.html
│   ├── css/
│   └── js/
├── locales/
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone or download the project
2. Navigate to the project directory:
   ```bash
   cd rice_2
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

### Development

1. Start the CSS watcher (compiles Tailwind):
   ```bash
   npm run watch:css
   ```

2. Create a `.env` file from `.env.example` and set your MAMP MySQL connection:
  ```bash
  copy .env.example .env
  ```

3. Create the database schema by running `db/schema.sql` in your MySQL client (phpMyAdmin / Workbench).

4. Start the backend (also serves the frontend from `public/`):
  ```bash
  npm run dev
  ```

5. Open `http://localhost:3000` in your browser

## Expose the site with ngrok

Use ngrok to make your local site accessible from the internet (useful for mobile testing, demos, and webhook callbacks).

### 1) Start the app

In terminal #1:

```bash
npm run dev
```

### 2) Start the ngrok tunnel

In terminal #2:

```bash
npm run tunnel
```

or directly:

```bash
ngrok http 3002
```

Or use the ngrok config in this repo:

```bash
ngrok start rice-mill --config ngrok.yml
```

On Windows you can start both the app and tunnel together:

```powershell
npm run dev:tunnel
```

Or double-click the batch file from the repo root:

```bat
start-with-ngrok.bat
```

To stop both processes:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop-server.ps1
```

Or double-click:

```bat
stop-server.bat
```

If ngrok asks for authentication, set `NGROK_AUTHTOKEN` in your shell first, then run the launcher. Example:

```powershell
$env:NGROK_AUTHTOKEN = 'your-token-here'
npm run dev:tunnel
```

The launcher will try to copy the public ngrok URL to your clipboard and open it in a browser once the tunnel is ready.

If you prefer a clickable launcher, use `start-with-ngrok.bat` from the repo root.

ngrok will print a public URL like `https://xxxx.ngrok-free.app` — open that URL to access the site.

### Notes

- If you changed the app port (via `PORT` in `.env`), tunnel that port instead: `ngrok http <port>`.
- ngrok's local inspection UI is available at `http://127.0.0.1:4040` while the tunnel is running.

### Build

To build the CSS for production:

```bash
npm run build:css
```

## Notifications Maintenance

Use these scripts to keep notification data consistent:

### 1) Add the unique index

This deduplicates existing rows and adds a uniqueness constraint on `notifications(type, resource_id, villager_id)`.

```bash
npm run db:migrate:notifications:index
```

### 2) Create notification sync triggers

This creates MySQL triggers that keep notifications in sync when `orders` or `milling_requests` change status.

```bash
npm run db:migrate:notifications:triggers
```

### 3) Clean up old final notifications

This removes notifications with final statuses (`completed`, `cancelled`) that are older than the retention window.

Dry run:

```bash
npm run db:cleanup:notifications -- --dry-run --days=90
```

Run cleanup:

```bash
npm run db:cleanup:notifications -- --days=90
```

### Scheduling automated cleanup

You can run the cleanup automatically each day using PM2. The repo includes a lightweight scheduler script and an PM2 app entry in `ecosystem.config.js` named `notifications-cleanup-scheduler`.

Start the scheduler with PM2:

```bash
pm2 start ecosystem.config.js --only notifications-cleanup-scheduler
pm2 save
```

View scheduler logs:

```bash
pm2 logs notifications-cleanup-scheduler --lines 200
```

The scheduler runs a dry-run on start, then runs the real cleanup daily at 03:00 local time. To change retention days, set the `CLEANUP_DAYS` env var for the process, e.g.:

```bash
pm2 start ecosystem.config.js --only notifications-cleanup-scheduler --update-env --env CLEANUP_DAYS=120
```

If you don't use PM2, you can also schedule the CLI via Windows Task Scheduler to run the `npm run db:cleanup:notifications -- --days=90` command daily.


## Features Implemented

### ✅ Frontend Pages

- **Home Page** (`views/index.html`)
  - Sticky header with navigation
  - Hero banner with CTA button
  - Mill cards grid (responsive: 1-3 columns)
  - Secondary CTA section
  - Footer with links and contact info

- **Milling Request Page** (`views/milling.html`)
  - Rice type selection (radio buttons)
  - Customer information form
  - Phone number validation (9-10 digits)
  - Date picker with DD/MM/YYYY format
  - Number of sacks validation
  - Real-time error messages
  - Loading state on submit button

- **Inquiry Page** (`views/inquiry.html`)
  - Subject and message textarea
  - Customer contact information
  - Form validation
  - Social media quick-contact buttons (LINE, Facebook, Phone, Email)
  - Card-based layout for channels

- **Contact Page** (`views/contact.html`)
  - Multiple contact channels (Phone, Email, LINE, Facebook)
  - Embedded Google Maps
  - FAQ section with collapsible details
  - Main office information
  - Hours of operation

### ✅ JavaScript Utilities

- **main.js**: Mobile menu toggle, form utilities, phone validation, date formatting
- **milling-form.js**: Milling request form validation and submission
- **inquiry-form.js**: Inquiry form validation and submission

### ✅ Styling

- **Tailwind CSS** with custom color palette (rice theme)
- Custom components: buttons, forms, cards, toasts
- Responsive utilities for mobile-first design
- Accessibility-focused styling (focus states, ARIA)
- Dark mode ready configuration

## Customization

### Colors

Edit `tailwind.config.js` to customize the rice theme colors:

```javascript
rice: {
  50: '#faf8f3',
  // ... more colors
  900: '#564637',
}
```

### Environment Variables

Update `.env` with your values:

- `MAIN_PHONE`: Your main contact phone
- `MAIN_EMAIL`: Your email address
- `LINE_URL`: Your LINE contact URL
- `FB_MESSENGER_URL`: Your Facebook Messenger URL
- `MAP_EMBED_URL`: Your embedded Google Maps URL

### i18n (Internationalization)

The project includes `locales/en.json` with all UI strings. This structure is ready for Thai translation:

1. Create `locales/th.json` with Thai translations
2. Update forms to use i18n keys
3. Implement language switcher in header

## Accessibility Features

- ✅ Semantic HTML structure
- ✅ ARIA labels on form fields and buttons
- ✅ Keyboard navigation support (Tab order)
- ✅ Focus visible states on all interactive elements
- ✅ Color contrast ratios meet WCAG AA standards
- ✅ Mobile-responsive touch targets (min 44x44px)
- ✅ Alt text placeholders for images
- ✅ Skip to main content link (optional)

## Future Enhancements

### Features to Add

- [ ] Map integration (Google Maps API)
- [ ] Dynamic mill loading from database
- [ ] Form submission to backend API
- [ ] Email notifications (nodemailer)
- [ ] Rate limiting & CSRF protection
- [ ] Admin dashboard for managing mills
- [ ] Order tracking system
- [ ] Customer testimonials section
- [ ] Image gallery / carousel

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari 12+, Chrome Android)

## Performance Tips

1. **Optimize Images**: Use WebP format with JPEG fallback
2. **Lazy Loading**: Add `loading="lazy"` to images
3. **Minify CSS/JS**: Build tools will handle this in production
4. **Gzip Compression**: Enable on server
5. **CDN**: Serve static assets from CDN in production

## Troubleshooting

### Tailwind Styles Not Showing

Make sure to run:
```bash
npm run build:css
```

And that `tailwind.config.js` has the correct content paths:
```javascript
content: [
  "./views/**/*.{html,ejs}",
  "./public/**/*.html"
]
```

### Forms Not Submitting

- Check console for errors (F12 > Console)
- Verify API endpoints are available
- Check CORS settings if backend is on different domain
- Ensure form IDs match script references

### Mobile Menu Not Working

Clear browser cache and hard reload (Ctrl+Shift+R or Cmd+Shift+R)

## License

MIT License - Feel free to use and modify as needed

## Support

For issues or questions, create an issue in the repository or contact the development team.

---

**Last Updated**: November 2025  
**Version**: 1.0.0 (Frontend)
