// We do cool art with regl and glslify

// Set up libraries
const regl = require('regl')()
const glsl = require('glslify')
const mat4 = require('gl-mat4')
let grid = require('grid-mesh')
let wireframe = require('screen-projected-lines')

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

// This shader does substack's screen-projected-lines wireframe but also waves
const vertWireframeWave = glsl`
  precision mediump float;
  
  #pragma glslify: linevoffset = require('screen-projected-lines')
  
  // How many waves in each axis do we support?
  #define MAX_WAVES 8
  // What even is pi?
  #define PI 3.1415926535897932384626433832795
  
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
  
  // And we account for time
  uniform float time;
  
  // We take some uniform amplitude, space frequency, time frequency, phase parameters
  // Waves that aren't used are all 0.
  uniform vec4 xwaves[MAX_WAVES];
  uniform vec4 zwaves[MAX_WAVES];
  
  // We also have wavelet parameters (bounds in space (x, y) and bounds in time
  // (z, w)) we can use with a cosine envelope to make local things. We use a
  // sin envelope. Zeros disable.
  uniform vec4 xwavelets[MAX_WAVES];
  uniform vec4 zwavelets[MAX_WAVES];
  
  // TODO: support wavelets in both space dimensions as well as time.
  
  // We have a function to compute a single wave
  float wave(in vec4 params, in float pos, in float t) {
    return params.x * cos(params.y * pos + params.z * t + params.w);
  }
  
  // We have a single envelope.
  float envelope(in float start, in float end, in float pos) {
    if (start == 0.0 && end == 0.0) {
      // Deactivated
      return 1.0;
    } else if(pos < start || pos > end) {
      // Out of bounds
      return 0.0;
    } else {
      return sin((pos - start) / (end - start) * PI);
    }
  }
  
  // We apply this envelope to the wave, doing the two enevlopes in 2d as per the parameters.
  float wavelet_envelope(in vec4 params, in float pos, in float t) {
    return envelope(params.x, params.y, pos) * envelope(params.z, params.w, t);
  }
  
  // We can also do waves based on local position and time
  vec3 wavify(in vec3 pos, in float t) {
    for (int i = 0; i < MAX_WAVES; i++) {
      pos.y += wave(xwaves[i], pos.x, t) * wavelet_envelope(xwavelets[i], pos.x, t);
    }
    for (int i = 0; i < MAX_WAVES; i++) {
      pos.y += wave(zwaves[i], pos.z, t) * wavelet_envelope(zwavelets[i], pos.z, t);
    }
    return pos;
  }
  
  void main () {
    mat4 proj_combined = proj * view;
    vec4 p = proj_combined * vec4(wavify(position, time), 1);
    vec4 n = proj_combined * vec4(wavify(nextpos, time), 1);
    vec4 offset = linevoffset(p, n, direction, aspect);
    // Just do normal wireframe
    gl_Position = p + offset * 0.02;
    
  }
`

// When did we start the art?
const art_start = new Date().getTime() / 1000

// Get the time in seconds since start of art
function now() {
  return new Date().getTime() / 1000 - art_start
}

function rand(low, high) {
  return low + Math.random() * (high - low);
}

// Make a renderer that draws an ocean
function createOcean(size) {
  // Define a grid
  let mesh = grid(size, size)

  // Convert mesh from 2d to 3d
  mesh.positions = mesh.positions.map((vec2) => {
    // Put the mesh in the XZ plane; Y is up.
    return [vec2[0], 0, vec2[1]]
  })
  
  // Wireframe it for screen-projected-lines
  mesh = wireframe(mesh)
  
  // How many waves does the shader allow?
  const MAX_WAVES = 8;
  
  // Define the draw to do
  let options = {
    frag: fragSolid,
    vert: vertWireframeWave,
    // Copy all the wireframe stuff over
    attributes: {
      position: mesh.positions,
      nextpos: mesh.nextPositions,
      direction: mesh.directions
    },
    elements: mesh.cells,
    uniforms: {
      color: [0, 0.7, 0.8, 1],
      time: () => { return now() },
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
        const t = 0.001 * tick
        const radius = 25
        const height = 5
        const center = [25, 0, 25]
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
  }
  
  for (let i = 0; i < MAX_WAVES; i++) {
    // Create random wave uniforms
    options.uniforms['xwaves[' + i + ']'] = [rand(0, 0.5), rand(0.3, 0.6), rand(0.5, 1.0), rand(0, 1)]
    options.uniforms['zwaves[' + i + ']'] = [rand(0, 0.5), rand(0.3, 0.6), rand(0.5, 1.0), rand(0, 1)]
    // Add random bounds
    options.uniforms['xwavelets[' + i + ']'] = [rand(0, 5), rand(45, 50), 0, 0]
    options.uniforms['zwavelets[' + i + ']'] = [rand(0, 5), rand(45, 50), 0, 0]
  }
  
  
  
  return regl(options);
}

// Create the drawing function
const drawOcean = createOcean(50);

regl.frame(() => {
  regl.clear({
    depth: 1,
    color: [0, 0, 0, 1]
  })

  // Draw the ocean every frame
  drawOcean()
})

