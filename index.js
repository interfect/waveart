// We do cool art with regl and glslify

// Set up libraries
const regl = require('regl')()
const glsl = require('glslify')
const mat4 = require('gl-mat4')
var grid = require('grid-mesh')
var wireframe = require('screen-projected-lines')

// Define shome shaders

// This fragment shader makes a cool screen-space color noise
const fragRainbow = glsl`
  // We need this or webgl freaks the fuck out  
  precision mediump float;

  // Grab a cool noise
  #pragma glslify: noise = require('glsl-noise/simplex/2d')
  
  uniform vec4 color;
  
  void main () {
    gl_FragColor = vec4(
      noise(vec2(gl_FragCoord.x * 0.01, gl_FragCoord.y * 0.01)) * 0.5 + 0.5,
      noise(vec2(gl_FragCoord.y * 0.01, gl_FragCoord.x * 0.01)) * 0.5 + 0.5,
      noise(vec2(10.0 + gl_FragCoord.x * 0.01, 10.0 + gl_FragCoord.y * 0.01)) * 0.5 + 0.5,
      1);
  }
`

// This fragment shader makes a solid color
const fragSolid = glsl`
  // We need this or webgl freaks the fuck out  
  precision mediump float;

  uniform vec4 color;
  
  void main () {
    gl_FragColor = color;
  }
`


function createOcean() {
  // Define a grid
  const size = 10;
  const mesh = grid(size, size)

  // Convert mesh from 2d to 3d  
  const positions = mesh.positions.map((vec2) => {
    vec2.push(0)
    return vec2
  })
  const cells = mesh.cells
  
  // Define the draw to do and return it
  return regl({
    frag: fragSolid,
    vert: glsl`
      precision mediump float;
      
      // Camera stuff
      uniform mat4 proj;
      uniform mat4 model;
      uniform mat4 view;
      
      attribute vec3 position;
      
      void main () {
        // Apply a sin wave to the mesh
        vec3 modPos = vec3(position.x, position.y, position.z + sin(position.x));
        // Then apply the transform
        gl_Position = proj * view * model * vec4(modPos, 1);
      }
    `,
    attributes: {
      // Mesh positions are in 2d so we put them at a Z
      position: positions
    },
    elements: cells,
    uniforms: {
      color: [1, 0, 0, 1],
      // Use a matrix stack ripped from the documentation.
      // This is how we stick the image into our window as a function of window size.
      proj: ({viewportWidth, viewportHeight}) =>
        mat4.perspective([],
          Math.PI / 2,
          viewportWidth / viewportHeight,
          0.01,
          1000),
      // The model is at the origin
      model: mat4.identity([]),
      // This is the camera matrix. It's the spinny one from the documentation.
      view: ({tick}) => {
        const t = 0.01 * tick
        const radius = 20;
        const height = 10
        return mat4.lookAt([],
          // Here is our eye
          [radius * Math.cos(t), height, radius * Math.sin(t)],
          // Here is where we look
          [0, 5, 0],
          // This is up
          [0, 1, 0])
      }
    }
  })
}

// Create the drawing function
const drawOcean = createOcean();

regl.frame(() => {
  regl.clear({
    depth: 1,
    color: [0, 0, 0, 1]
  })

  // Draw the ocean every frame
  drawOcean()
})

