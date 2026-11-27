Put this code in a code viewer to run it

```

<script> fetch("https://raw.githubusercontent.com/speedrunnerthis/hoops/refs/heads/main/index.html") .then(r=>{if(!r.ok)throw Error(r.status);return r.text()}) .then(h=>{document.open();document.write(h);document.close()}); </script>

```
