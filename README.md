Put this code in a code viewer to run it

```

<script> fetch("https://raw.githubusercontent.com/speedrunnerthis/hoops/refs/heads/main/index.html") .then(r=>{if(!r.ok)throw Error(r.status);return r.text()}) .then(h=>{document.open();document.write(h);document.close()}); </script>

```
Optional button code that automatically opens in a new tab: <button id="launchButton">Launch Game</button>

<script>
document.getElementById("launchButton").addEventListener("click", () => {
    // Open the tab immediately so popup blockers don't interfere
    const newTab = window.open("about:blank", "_blank");

    if (!newTab) {
        alert("Please allow pop-ups for this website!");
        return;
    }

    newTab.document.write("<h2>Loading...</h2>");

    fetch("https://raw.githubusercontent.com/speedrunnerthis/hoops/refs/heads/main/index.html")
        .then(response => {
            if (!response.ok) throw new Error(response.status);
            return response.text();
        })
        .then(html => {
            // Preserve relative asset paths
            const base = '<base href="https://raw.githubusercontent.com/speedrunnerthis/hoops/refs/heads/main/">';

            html = html.replace(/<head([^>]*)>/i, match => match + base);

            newTab.document.open();
            newTab.document.write(html);
            newTab.document.close();
        })
        .catch(error => {
            newTab.document.body.innerHTML =
                "<h2>Failed to load</h2><p>" + error.message + "</p>";
        });
});
</script>
