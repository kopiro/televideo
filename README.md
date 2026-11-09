# Televideo

[A touch-friendly reader for Rai Televideo](https://kopiro.github.io/televideo/).

Enter a page (100–899) and subpage (1–99), then press **Vai alla pagina** or Enter.
Use the arrow buttons to browse, the shortcuts for common pages, or **Ricarica**
to reload the current page. The layout supports portrait and landscape screens.
Not every page or subpage exists; unavailable content shows a retry option.

The app is plain HTML, CSS and JavaScript, with no build step or dependencies.
It requests page metadata from Rai's public API and displays the supplied image.
A connection to Rai is required; the app does not provide offline news.

Run the regression tests with Node.js:

```sh
node --test tests/script.test.cjs
```

GitHub Pages serves the root of the `main` branch.
