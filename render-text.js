// render-text.js: pre-bake vectorized text to work around vectorize-text not being good

const Canvas = require('canvas')
const vectorizeText = require('vectorize-text')
const fs = require('fs')

// Get a canvas context
// Canvas must be big enough to display the string you are trying to vectorize!
const scratch = new Canvas(1000, 1000)
const ctx = scratch.getContext('2d')

let mesh = vectorizeText('Reticulating Splines', {
  textAlign: 'center',
  textBaseline: 'middle',
  font: 'Times New Roman',
  canvas: scratch,
  context: ctx
})

fs.writeFile('text.json', JSON.stringify(mesh), (err) => {
  if (err) throw err
  console.log('Wrote vectorized text to text.json')
})

