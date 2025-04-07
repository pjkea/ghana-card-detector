// test/setupTests.js
require('@testing-library/jest-dom');
require('jest-canvas-mock');

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs', () => ({
  ready: jest.fn().mockResolvedValue(undefined),
  tidy: jest.fn((callback) => callback()),
  browser: {
    fromPixels: jest.fn().mockReturnValue({
      shape: [720, 1280],
      div: jest.fn().mockReturnThis(),
      expandDims: jest.fn().mockReturnThis(),
      dispose: jest.fn()
    }),
  },
  image: {
    resizeBilinear: jest.fn().mockReturnValue({
      div: jest.fn().mockReturnThis(),
      expandDims: jest.fn().mockReturnThis(),
      dispose: jest.fn()
    }),
  },
  pad: jest.fn().mockReturnValue({
    div: jest.fn().mockReturnThis(),
    expandDims: jest.fn().mockReturnThis(),
    dispose: jest.fn()
  }),
  scalar: jest.fn().mockReturnValue(255),
}));

// Mock TensorFlow.js TFLite
jest.mock('@tensorflow/tfjs-tflite', () => ({
  loadTFLiteModel: jest.fn().mockResolvedValue({
    predict: jest.fn().mockResolvedValue({
      array: jest.fn().mockResolvedValue([[
        [0.5, 0.5, 0.2, 0.2, 0.9], // [x, y, w, h, conf]
      ]]),
      dispose: jest.fn()
    })
  })
}));

// Mock MediaDevices API
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: jest.fn().mockReturnValue([
        { stop: jest.fn() }
      ])
    })
  }
});

// Create a real video element
const mockVideo = document.createElement('video');
// Use defineProperty for read-only properties
Object.defineProperties(mockVideo, {
  videoWidth: { value: 1280 },
  videoHeight: { value: 720 },
  readyState: { value: 4 } // HAVE_ENOUGH_DATA
});
mockVideo.play = jest.fn().mockResolvedValue(undefined);
mockVideo.srcObject = null;

// Create real canvas elements
const mockDetectionCanvas = document.createElement('canvas');
const mockCapturedCanvas = document.createElement('canvas'); 

// Setup canvas contexts
const mockDetectionContext = {
  clearRect: jest.fn(),
  drawImage: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  measureText: jest.fn().mockReturnValue({ width: 200 }),
  strokeRect: jest.fn(),
  fillStyle: '',
  font: '',
  textAlign: '',
  lineWidth: 1,
  strokeStyle: ''
};

const mockCapturedContext = {
  ...mockDetectionContext,
  toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,fake-image-data'),
};

mockDetectionCanvas.getContext = jest.fn().mockReturnValue(mockDetectionContext);
mockCapturedCanvas.getContext = jest.fn().mockReturnValue(mockCapturedContext);
mockCapturedCanvas.toDataURL = jest.fn().mockReturnValue('data:image/jpeg;base64,fake-image-data');
mockCapturedCanvas.toBlob = jest.fn().mockImplementation((callback) => {
  callback(new Blob(['fake-blob-data'], { type: 'image/jpeg' }));
});

// Mock document methods
document.getElementById = jest.fn().mockImplementation((id) => {
  switch(id) {
    case 'webcam':
      return mockVideo;
    case 'detection-canvas':
      return mockDetectionCanvas;
    case 'captured-card': 
      return mockCapturedCanvas;
    case 'status':
    case 'model-status':
    case 'capture-status':
      return document.createElement('div');
    case 'start-btn':
    case 'capture-btn':
    case 'auto-capture-btn':
    case 'send-btn':
      return document.createElement('button');
    default:
      return null;
  }
});

// Mock fetch API
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ valid: true })
  })
);

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn(callback => setTimeout(callback, 0));

// Suppress console.error during tests
console.error = jest.fn();