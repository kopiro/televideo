# Televideo

[A touch-friendly reader for Rai Televideo](https://kopiro.github.io/televideo/).

Enter a page (100–899) and subpage (1–99), then press **Vai** or Enter.
Use the arrow buttons to browse, or press **Vai** again to reload the current page. The layout supports portrait and landscape screens.
Not every page or subpage exists; unavailable content shows a retry option.

The app is plain HTML, CSS and JavaScript, with no build step or dependencies.
It requests page metadata from Rai's public API and displays the supplied image.
A connection to Rai is required; the app does not provide offline news.

Run the regression tests with Node.js:

```sh
node --test tests/script.test.cjs
```

GitHub Pages serves the root of the `main` branch.

For local browser testing, serve the project on loopback:

```sh
python3 -m http.server 0 --bind 127.0.0.1
```

Open the loopback URL printed by the server. Port `0` selects an available port.
