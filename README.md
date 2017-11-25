# Reticulating Splines

[An art.](https://ipfs.io/ipfs/QmWNFXedq1vrnxkwvHBciz7HhHSG6yCFwAtNUfdACPxL6E)

[![Screenshot of the art, consisting of the text "Reticulating Splines" floating as a rainbow outline over a blue wireframe sea.](screenshot.png)](https://ipfs.io/ipfs/QmWNFXedq1vrnxkwvHBciz7HhHSG6yCFwAtNUfdACPxL6E)

To install:

You need Browserify:

```
sudo npm install -g browserify
```

Than you can clone the rep and:

```
# Omit CXX=clang if you aren't on OS X
CXX=clang npm install
npm run build
```

Then point your browser at `build/index.html`.

## Development

Set up watching:

```
sudo npm install -g watchify
npm run watch
```

Then edit and refresh.

## Rendering text

`vectorize-text` misbehaves in a variety of browsers, depending on the input string, so we pre-vectorize the text we want to display using a script, `render-text.js`. This needs Cairo installed, which on OS X can be accomplished with:

```
sudo port install cairo
```

Then you just run `node render-text.js` and it will regenerate `text.json`.

