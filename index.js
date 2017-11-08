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

// This shader makes things wavy in Y
const vertWavy = glsl`
  precision mediump float;
  
  // Camera stuff
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  
  attribute vec3 position;
  
  void main () {
    // Apply a sin wave to the mesh in y
    vec3 modPos = vec3(position.x, position.y + sin(position.x), position.z);
    // Then apply the transform
    gl_Position = proj * view * model * vec4(modPos, 1);
  }
`

// This shader does substack's screen-projected-lines wireframe
const vertWireframe = glsl`
  precision mediump float;
  
  #pragma glslify: linevoffset = require('screen-projected-lines')
  
  // Camera stuff
  uniform mat4 proj;
  uniform mat4 model;
  uniform mat4 view;
  
  // We need the screen aspect ratio
  uniform float aspect;
  
  attribute vec3 position;
  
  // We also need the position of the "next" vertex to draw a line to
  attribute vec3 nextpos;
  
  // And a float describing the direction to it (?)
  attribute float direction;
  
  void main () {
    mat4 proj_combined = proj * view;
    vec4 p = proj_combined*vec4(position, 1);
    vec4 n = proj_combined*vec4(nextpos, 1);
    vec4 offset = linevoffset(p, n, direction, aspect);
    // Just do normal wireframe
    gl_Position = p + offset*0.02;
    
  }
`


function createOcean() {
  // Define a grid
  const size = 10;
  var mesh = grid(size, size)

  // Convert mesh from 2d to 3d
  mesh.positions = mesh.positions.map((vec2) => {
    // Put the mesh in the XZ plane; Y is up.
    return [vec2[0], 0, vec2[1]]
  })
  
  // Wireframe it for screen-projected-lines
  mesh = wireframe(mesh)
  
  // Define the draw to do and return it
  return regl({
    frag: fragSolid,
    vert: vertWireframe,
    // Copy all the wireframe stuff over
    attributes: {
      position: mesh.positions,
      nextpos: mesh.nextPositions,
      direction: mesh.directions
    },
    elements: mesh.cells,
    uniforms: {
      color: [0, 0.7, 0.8, 1],
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
      // This is the camera matrix. It's the spinny one from the documentation, modified to spin gooder
      view: ({tick}) => {
        const t = 0.01 * tick
        const radius = 10
        const height = 2.5
        const center = [5, 0, 5]
        return mat4.lookAt([],
          // Here is our eye
          [center[0] + radius * Math.cos(t), center[1] + height, center[2] + radius * Math.sin(t)],
          // Here is where we look
          center,
          // This is up
          [0, 1, 0])
      },
      // We alsop need the aspect ratio for screen-projected-lines
      aspect: ({viewportWidth, viewportHeight}) => {
        return viewportWidth / viewportHeight
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

