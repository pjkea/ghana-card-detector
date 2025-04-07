# Ghana Card Detector

A JavaScript/TypeScript library for detecting and capturing Ghana ID Cards using browser-based computer vision.

## Features

- Real-time Ghana Card detection using TensorFlow.js and a YOLOv8 model
- Automatic and manual card capture options
- Quality assessment for captured cards (alignment, aspect ratio, etc.)
- Responsive design that works on mobile and desktop devices
- Built-in UI components with customizable styling
- TypeScript support with full type definitions

## Installation

```bash
npm install ghana-card-detector
```

## Requirements

- TensorFlow.js (peer dependency)
- TensorFlow.js TFLite (peer dependency)
- A YOLOv8 TFLite model for card detection

## Basic Usage

### HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ghana Card Detector Demo</title>
    <!-- TensorFlow.js Core -->
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0"></script>
    <!-- TFLite Support -->
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.9/dist/tf-tflite.min.js"></script>
</head>
<body>
    <div class="ghana-detector-container">
        <h1>Ghana Card Auto-Capture</h1>
        
        <div class="ghana-detector-status-container">
            <div id="status" class="ghana-detector-status">Initializing detector...</div>
            <div id="model-status" class="ghana-detector-model-status"></div>
        </div>
        
        <div class="ghana-detector-camera-container">
            <div class="ghana-detector-video-container">
                <video id="webcam" class="ghana-detector-webcam" autoplay playsinline></video>
                <canvas id="detection-canvas" class="ghana-detector-canvas"></canvas>
                <div class="ghana-detector-guide-overlay">
                    <div class="ghana-detector-card-guide"></div>
                </div>
            </div>
            
            <div class="ghana-detector-controls">
                <button id="start-btn" class="ghana-detector-btn">Start Camera</button>
                <button id="capture-btn" class="ghana-detector-btn" disabled>Manual Capture</button>
                <button id="auto-capture-btn" class="ghana-detector-btn" disabled>Enable Auto-Capture</button>
            </div>
        </div>
        
        <div class="ghana-detector-result-container">
            <h2>Captured Card</h2>
            <canvas id="captured-card" class="ghana-detector-captured-card"></canvas>
            <div class="ghana-detector-capture-info">
                <div id="capture-status" class="ghana-detector-capture-status">No card captured yet</div>
                <button id="send-btn" class="ghana-detector-btn ghana-detector-send-btn" disabled>Submit</button>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

### JavaScript Integration

```javascript
// app.js
import GhanaCardDetector from 'ghana-card-detector';

document.addEventListener('DOMContentLoaded', async () => {
  // Create detector instance
  const detector = new GhanaCardDetector({
    modelPath: 'path/to/model.tflite',
    confidenceThreshold: 0.85,
    minConsecutiveDetections: 3,
    onCapture: (imageDataUrl) => {
      console.log('Card captured:', imageDataUrl);
      // Send to your backend or do something with the image
    }
  });
  
  // Initialize detector
  try {
    await detector.initialize();
    
    // Start camera automatically after initialization (optional)
    await detector.startCamera();
  } catch (error) {
    console.error('Failed to initialize detector:', error);
  }
});
```

### Using with TypeScript

```typescript
import GhanaCardDetector, { DetectorOptions } from 'ghana-card-detector';

document.addEventListener('DOMContentLoaded', async () => {
  const options: DetectorOptions = {
    modelPath: 'path/to/model.tflite',
    confidenceThreshold: 0.85,
    onCapture: (imageDataUrl: string) => {
      // Handle captured image
    },
    onStatusChange: (message: string, className: string) => {
      // Handle status changes
    }
  };
  
  const detector = new GhanaCardDetector(options);
  await detector.initialize();
});
```

## API Reference

### `GhanaCardDetector` Class

#### Constructor Options

```typescript
interface DetectorOptions {
  // Path to the YOLOv8 TFLite model
  modelPath?: string; // default: 'models/autocapture.tflite'
  
  // Minimum confidence threshold for detecting cards
  confidenceThreshold?: number; // default: 0.85
  
  // Number of consecutive good detections required for auto-capture
  minConsecutiveDetections?: number; // default: 3
  
  // Override default element IDs
  elementIds?: {
    video?: string; // default: 'webcam'
    detectionCanvas?: string; // default: 'detection-canvas'
    capturedCanvas?: string; // default: 'captured-card'
    status?: string; // default: 'status'
    modelStatus?: string; // default: 'model-status'
    captureStatus?: string; // default: 'capture-status'
    startButton?: string; // default: 'start-btn'
    captureButton?: string; // default: 'capture-btn'
    autoCaptureButton?: string; // default: 'auto-capture-btn'
    sendButton?: string; // default: 'send-btn'
  };
  
  // Called when a card is captured (auto or manual)
  onCapture?: (imageDataUrl: string) => void;
  
  // Called when status changes
  onStatusChange?: (status: string, className: string) => void;
}
```

#### Methods

- `initialize(): Promise<void>` - Initializes the detector and loads the model
- `startCamera(): Promise<void>` - Starts the camera and begins detection
- `stopCamera(): void` - Stops the camera and detection process
- `toggleCamera(): Promise<void>` - Toggles camera on/off
- `toggleAutoCapture(): void` - Enables/disables auto-capture mode
- `manualCapture(): void` - Manually captures the current frame
- `sendToBackend(apiUrl?: string): Promise<any>` - Sends captured card to a backend API
- `setStatus(message: string, className?: string): void` - Updates status display
- `isModelLoaded(): boolean` - Checks if model is loaded
- `isCameraActive(): boolean` - Checks if camera is active
- `isAutoCapture(): boolean` - Checks if auto-capture is enabled
- `isCardCaptured(): boolean` - Checks if a card has been captured
- `getCapturedCardDataUrl(format?: string, quality?: number): string | null` - Gets captured card as data URL

## Advanced Usage

### Custom Event Handling

```javascript
const detector = new GhanaCardDetector({
  onCapture: (imageDataUrl) => {
    // Create an image element with the captured card
    const img = new Image();
    img.src = imageDataUrl;
    document.getElementById('captured-image').appendChild(img);
    
    // You could also send to your server
    fetch('https://your-api.com/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image: imageDataUrl })
    });
  },
  
  onStatusChange: (message, className) => {
    // Log all status changes
    console.log(`Status: ${message} (${className})`);
    
    // Show user-friendly notifications
    if (className === 'status-error') {
      showErrorNotification(message);
    } else if (className === 'status-success') {
      showSuccessNotification(message);
    }
  }
});
```

### Using without Auto-Initialization

```javascript
const detector = new GhanaCardDetector();

// Initialize manually when ready
document.getElementById('init-button').addEventListener('click', async () => {
  try {
    await detector.initialize();
    document.getElementById('camera-button').disabled = false;
  } catch (error) {
    console.error('Initialization failed:', error);
  }
});

// Start camera manually when ready
document.getElementById('camera-button').addEventListener('click', async () => {
  try {
    await detector.startCamera();
  } catch (error) {
    console.error('Camera access failed:', error);
  }
});
```

## Model Training and Preparation

This library uses a YOLOv8 TFLite model for Ghana Card detection. You will need to:

1. Train your own YOLOv8 model on Ghana Card images
2. Export the model to TFLite format
3. Place the model file in a location accessible by your web application
4. Set the correct path to the model in the constructor options

### Sample Code for Model Training (Python)

```python
from ultralytics import YOLO

# Train a YOLOv8n model on your custom Ghana Card dataset
model = YOLO('yolov8n.pt')
results = model.train(data='path/to/ghana_cards.yaml', epochs=100, imgsz=640)

# Export to TFLite format
model.export(format='tflite')
```

## Troubleshooting

### Common Issues

1. **Model not loading**: Ensure the model path is correct and the model is accessible
2. **Camera not starting**: Check browser permissions for camera access
3. **Poor detection performance**: The model may need more training data or fine-tuning
4. **High CPU/memory usage**: Consider using a smaller YOLOv8 model (e.g., YOLOv8n)

### Browser Compatibility

This library has been tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Mobile browser support:
- Chrome for Android
- Safari for iOS

## License

MIT