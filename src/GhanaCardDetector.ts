import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

// Interfaces
export interface DetectorOptions {
  modelPath?: string;
  confidenceThreshold?: number;
  minConsecutiveDetections?: number;
  elementIds?: {
    video?: string;
    detectionCanvas?: string;
    capturedCanvas?: string;
    status?: string;
    modelStatus?: string;
    captureStatus?: string;
    startButton?: string;
    captureButton?: string;
    autoCaptureButton?: string;
    sendButton?: string;
  };
  onCapture?: (imageDataUrl: string) => void;
  onStatusChange?: (status: string, className: string) => void;
}

interface Detection {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  aspectRatio: number;
  alignmentScore: number;
}

interface ImageDimensions {
  inputSize: number;
  originalWidth: number;
  originalHeight: number;
  topPadding: number;
  leftPadding: number;
  scale: number;
}

// Default element IDs
const DEFAULT_ELEMENT_IDS = {
  video: 'webcam',
  detectionCanvas: 'detection-canvas',
  capturedCanvas: 'captured-card',
  status: 'status',
  modelStatus: 'model-status',
  captureStatus: 'capture-status',
  startButton: 'start-btn',
  captureButton: 'capture-btn',
  autoCaptureButton: 'auto-capture-btn',
  sendButton: 'send-btn'
};

class GhanaCardDetector {
  // DOM Elements
  private videoElement: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private capturedCanvas: HTMLCanvasElement;
  private statusElement: HTMLElement | null;
  private modelStatusElement: HTMLElement | null;
  private captureStatusElement: HTMLElement | null;
  
  private startBtn: HTMLButtonElement | null;
  private captureBtn: HTMLButtonElement | null;
  private autoCaptureBtn: HTMLButtonElement | null;
  private sendBtn: HTMLButtonElement | null;
  
  // Canvas contexts
  private ctx: CanvasRenderingContext2D | null;
  private capturedCtx: CanvasRenderingContext2D | null;
  
  // Detection parameters
  private modelPath: string;
  private model: any | null;
  private modelLoaded: boolean;
  private cameraActive: boolean;
  private autoCapture: boolean;
  private processing: boolean;
  private cardCaptured: boolean;
  
  // Detection thresholds
  private consecutiveDetections: number;
  private minConsecutiveDetections: number;
  private confidenceThreshold: number;
  
  // Event callbacks
  private onCapture?: (imageDataUrl: string) => void;
  private onStatusChange?: (status: string, className: string) => void;
  
  constructor(options: DetectorOptions = {}) {
    // Setup options with defaults
    const {
      modelPath = 'models/autocapture.tflite',
      confidenceThreshold = 0.85,
      minConsecutiveDetections = 3,
      elementIds = {},
      onCapture,
      onStatusChange
    } = options;
    
    // Merge element IDs with defaults
    const ids = { ...DEFAULT_ELEMENT_IDS, ...elementIds };
    
    // Store callbacks
    this.onCapture = onCapture;
    this.onStatusChange = onStatusChange;
    
    // Get DOM elements
    this.videoElement = document.getElementById(ids.video) as HTMLVideoElement;
    this.canvas = document.getElementById(ids.detectionCanvas) as HTMLCanvasElement;
    this.capturedCanvas = document.getElementById(ids.capturedCanvas) as HTMLCanvasElement;
    this.statusElement = document.getElementById(ids.status);
    this.modelStatusElement = document.getElementById(ids.modelStatus);
    this.captureStatusElement = document.getElementById(ids.captureStatus);
    
    this.startBtn = document.getElementById(ids.startButton) as HTMLButtonElement;
    this.captureBtn = document.getElementById(ids.captureButton) as HTMLButtonElement;
    this.autoCaptureBtn = document.getElementById(ids.autoCaptureButton) as HTMLButtonElement;
    this.sendBtn = document.getElementById(ids.sendButton) as HTMLButtonElement;
    
    // Setup canvas contexts
    this.ctx = this.canvas?.getContext('2d') || null;
    this.capturedCtx = this.capturedCanvas?.getContext('2d') || null;
    
    // Initialize capturedCanvas if it exists
    if (this.capturedCanvas && this.capturedCtx) {
      this.capturedCanvas.width = 640;
      this.capturedCanvas.height = 400;
      this.capturedCtx.fillStyle = '#f0f0f0';
      this.capturedCtx.fillRect(0, 0, this.capturedCanvas.width, this.capturedCanvas.height);
      this.capturedCtx.font = '16px Arial';
      this.capturedCtx.fillStyle = '#6c757d';
      this.capturedCtx.textAlign = 'center';
      this.capturedCtx.fillText('No card captured yet', this.capturedCanvas.width / 2, this.capturedCanvas.height / 2);
    }
    
    // Detection parameters
    this.modelPath = modelPath;
    this.model = null;
    this.modelLoaded = false;
    this.cameraActive = false;
    this.autoCapture = false;
    this.processing = false;
    this.cardCaptured = false;
    
    // Detection thresholds
    this.consecutiveDetections = 0;
    this.minConsecutiveDetections = minConsecutiveDetections;
    this.confidenceThreshold = confidenceThreshold;
    
    // Initialize event listeners
    this.initEventListeners();
  }
  
  public async initialize(): Promise<void> {
    try {
      this.setStatus('Loading TensorFlow.js...', 'status-loading');
      
      if (typeof tf === 'undefined') {
        throw new Error('TensorFlow.js not loaded. Please check your internet connection.');
      }
      
      this.setStatus('Loading Ghana Card detection model...', 'status-loading');
      this.setModelStatus('Initializing...');
      
      // Initialize TensorFlow.js
      await tf.ready();
      
      if (typeof tflite === 'undefined') {
        throw new Error('TensorFlow.js TFLite module not loaded');
      }
      
      // Load the TFLite model
      this.model = await tflite.loadTFLiteModel(this.modelPath);
      this.modelLoaded = true;
      
      this.setStatus('Model loaded successfully. Ready to start camera.', 'status-success');
      this.setModelStatus(`Model loaded: YOLOv8 TFLite (${this.modelPath})`);
      
    } catch (error: any) {
      this.setStatus(`Error initializing detector: ${error.message}`, 'status-error');
      this.setModelStatus('Failed to load model');
      throw error;
    }
  }
  
  private initEventListeners(): void {
    this.startBtn?.addEventListener('click', () => this.toggleCamera());
    this.captureBtn?.addEventListener('click', () => this.manualCapture());
    this.autoCaptureBtn?.addEventListener('click', () => this.toggleAutoCapture());
    this.sendBtn?.addEventListener('click', () => this.sendToBackend());
  }
  
  public async toggleCamera(): Promise<void> {
    if (this.cameraActive) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }
  
  public async startCamera(): Promise<void> {
    if (!this.modelLoaded) {
      this.setStatus('Model not loaded yet. Please wait...', 'status-warning');
      return;
    }
    
    try {
      this.setStatus('Requesting camera access...', 'status-loading');
      
      // Request camera with preferred settings
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.videoElement) {
        this.videoElement.srcObject = stream;
      } else {
        throw new Error('Video element not found');
      }
      
      // Wait for video to be ready
      await new Promise<void>(resolve => {
        if (this.videoElement) {
          this.videoElement.onloadedmetadata = () => {
            this.videoElement.play();
            resolve();
          };
        } else {
          resolve();
        }
      });
      
      // Update canvas size to match video
      if (this.canvas && this.videoElement) {
        this.canvas.width = this.videoElement.videoWidth;
        this.canvas.height = this.videoElement.videoHeight;
      }
      
      this.cameraActive = true;
      
      if (this.startBtn) this.startBtn.textContent = 'Stop Camera';
      if (this.captureBtn) this.captureBtn.disabled = false;
      if (this.autoCaptureBtn) this.autoCaptureBtn.disabled = false;
      
      // Auto-enable auto-capture
      this.toggleAutoCapture();
      
      this.setStatus('Camera active. Position a Ghana Card in the frame.', 'status-active');
      
      // Start detection loop
      this.startDetectionLoop();
    } catch (error: any) {
      this.setStatus(`Camera access error: ${error.message}`, 'status-error');
      throw error;
    }
  }
  
  public stopCamera(): void {
    // Stop all tracks from the stream
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = (this.videoElement.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    
    // Reset detection canvas
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // Update UI
    this.cameraActive = false;
    this.autoCapture = false;
    
    if (this.startBtn) this.startBtn.textContent = 'Start Camera';
    if (this.captureBtn) this.captureBtn.disabled = true;
    if (this.autoCaptureBtn) {
      this.autoCaptureBtn.disabled = true;
      this.autoCaptureBtn.textContent = 'Enable Auto-Capture';
    }
    
    this.setStatus('Camera stopped.', 'status-warning');
  }
  
  public toggleAutoCapture(): void {
    this.autoCapture = !this.autoCapture;
    
    if (this.autoCaptureBtn) {
      this.autoCaptureBtn.textContent = this.autoCapture ? 'Disable Auto-Capture' : 'Enable Auto-Capture';
    }
    
    if (this.autoCapture) {
      this.setStatus('Auto-capture enabled. Hold a Ghana Card steady in the frame.', 'status-active');
      this.consecutiveDetections = 0;
    } else {
      this.setStatus('Auto-capture disabled.', 'status-warning');
    }
  }
  
  private startDetectionLoop(): void {
    if (!this.cameraActive) return;
    
    // Run detection if not currently processing
    if (!this.processing) {
      this.detectCard();
    }
    
    // Continue the loop
    requestAnimationFrame(() => this.startDetectionLoop());
  }
  
  private async preprocessImage(): Promise<{ tensor: tf.Tensor4D, imageDims: ImageDimensions }> {
    let tensor: tf.Tensor4D | null = null;
    let imageDims: ImageDimensions | null = null;
    
    // Use a try-finally block to ensure tensor cleanup if there's an error
    try {
      if (!this.videoElement) {
        throw new Error("Video element not available");
      }
      
      // Convert video to tensor
      const videoFrame = tf.browser.fromPixels(this.videoElement);
      
      // Get dimensions
      const videoHeight = videoFrame.shape[0];
      const videoWidth = videoFrame.shape[1];
      
      // YOLOv8 needs 640x640 square input
      const inputSize = 640;
      
      // Calculate scale to maintain aspect ratio
      const scale = Math.min(inputSize / videoWidth, inputSize / videoHeight);
      const scaledWidth = Math.round(videoWidth * scale);
      const scaledHeight = Math.round(videoHeight * scale);
      
      // Resize while maintaining aspect ratio
      const resized = tf.image.resizeBilinear(videoFrame, [scaledHeight, scaledWidth]);
      
      // Create black padding
      const paddingHeight = inputSize - scaledHeight;
      const paddingWidth = inputSize - scaledWidth;
      const topPadding = Math.floor(paddingHeight / 2);
      const leftPadding = Math.floor(paddingWidth / 2);
      
      // Pad the image to get a square input of 640x640
      const padded = tf.pad(
        resized,
        [
          [topPadding, paddingHeight - topPadding],
          [leftPadding, paddingWidth - leftPadding],
          [0, 0]
        ]
      );
      
      // Normalize values to [0, 1]
      const normalized = padded.div(tf.scalar(255));
      
      // Add batch dimension and keep reference outside tidy
      tensor = normalized.expandDims(0) as tf.Tensor4D;
      
      // Store original dimensions for mapping back
      imageDims = {
        inputSize,
        originalWidth: videoWidth,
        originalHeight: videoHeight,
        topPadding,
        leftPadding,
        scale
      };
      
      // Dispose of intermediate tensors to avoid memory leaks
      videoFrame.dispose();
      resized.dispose();
      padded.dispose();
      normalized.dispose();
      
      return { tensor, imageDims };
    } catch (error) {
      // Clean up tensor if there was an error
      if (tensor) {
        tensor.dispose();
      }
      throw error;
    }
  }
  
  private async detectCard(): Promise<void> {
    if (!this.cameraActive || !this.modelLoaded || !this.videoElement || 
        this.videoElement.readyState !== this.videoElement.HAVE_ENOUGH_DATA) {
      return;
    }
    
    this.processing = true;
    
    try {
      // Preprocess the video frame
      const { tensor, imageDims } = await this.preprocessImage();
      
      // Run inference
      const predictions = await this.model.predict(tensor);
      
      // Process results
      const detections = await this.processYoloOutput(predictions, imageDims);
      
      // Clear previous drawings
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
      
      // Draw detections
      if (detections.length > 0) {
        this.drawDetections(detections);
        
        // Check for auto-capture
        if (this.autoCapture) {
          this.checkForAutoCapture(detections);
        }
      } else {
        // Reset consecutive detections counter
        this.consecutiveDetections = 0;
      }
      
      // Clean up tensors
      tensor.dispose();
      if (Array.isArray(predictions)) {
        predictions.forEach(p => {
          if (p && typeof p.dispose === 'function') {
            p.dispose();
          }
        });
      } else if (predictions && typeof predictions.dispose === 'function') {
        predictions.dispose();
      }
      
    } catch (error) {
      console.error('Detection error:', error);
    }
    
    this.processing = false;
  }
  
  private async processYoloOutput(predictions: any, imageDims: ImageDimensions): Promise<Detection[]> {
    const detections: Detection[] = [];
    
    try {
      // Convert predictions to arrays for processing
      let outputArray: any; // Use any for now, will narrow down later
      
      // Handle different output formats
      if (Array.isArray(predictions)) {
        // If model returns multiple outputs, use the first one
        outputArray = await predictions[0].array();
      } else {
        // If model returns a single output
        outputArray = await predictions.array();
      }
      
      // Determine YOLOv8 output format (usually [1, 8400, 6] or [1, 6, 8400])
      // Format 1: [batch, predictions, outputs] - each row is a detection with [x, y, w, h, conf, class]
      if (outputArray[0].length > outputArray[0][0].length) {
        // Number of detections
        const numDetections = outputArray[0].length;
        
        for (let i = 0; i < numDetections; i++) {
          if (outputArray[0][i] && outputArray[0][i].length >= 5) {
            // TypeScript safety - check array access
            // YOLOv8 outputs normalized coordinates [0-1]
            const x = Number(outputArray[0][i][0]); // center x
            const y = Number(outputArray[0][i][1]); // center y
            const w = Number(outputArray[0][i][2]); // width
            const h = Number(outputArray[0][i][3]); // height
            const conf = Number(outputArray[0][i][4]); // confidence
            
            // Skip low confidence detections
            if (conf > this.confidenceThreshold) {
              // Convert normalized coordinates to pixels
              // YOLOv8 outputs center coordinates, convert to top-left
              const boxX = (x - w/2) * imageDims.inputSize;
              const boxY = (y - h/2) * imageDims.inputSize;
              const boxWidth = w * imageDims.inputSize;
              const boxHeight = h * imageDims.inputSize;
              
              // Convert from padded image back to original video coordinates
              const originalX = (boxX - imageDims.leftPadding) / imageDims.scale;
              const originalY = (boxY - imageDims.topPadding) / imageDims.scale;
              const originalWidth = boxWidth / imageDims.scale;
              const originalHeight = boxHeight / imageDims.scale;
              
              // Calculate aspect ratio
              const aspectRatio = originalWidth / originalHeight;
              
              // Add to detections
              detections.push({
                box: {
                  x: originalX,
                  y: originalY,
                  width: originalWidth,
                  height: originalHeight
                },
                confidence: conf,
                aspectRatio: aspectRatio,
                alignmentScore: this.calculateAlignmentScore(aspectRatio, originalWidth * originalHeight, {
                  originalWidth: imageDims.originalWidth,
                  originalHeight: imageDims.originalHeight
                })
              });
            }
          }
        }
      }
      // Format 2: [batch, outputs, predictions] - outputs are arranged by feature
      else if (outputArray[0] && outputArray[0][0]) {
        // Number of detections
        const numDetections = outputArray[0][0].length;
        
        for (let i = 0; i < numDetections; i++) {
          if (outputArray[0][0][i] !== undefined && 
              outputArray[0][1][i] !== undefined && 
              outputArray[0][2][i] !== undefined && 
              outputArray[0][3][i] !== undefined && 
              outputArray[0][4][i] !== undefined) {
                
            // YOLOv8 outputs normalized coordinates [0-1]
            const x = Number(outputArray[0][0][i]); // center x
            const y = Number(outputArray[0][1][i]); // center y
            const w = Number(outputArray[0][2][i]); // width
            const h = Number(outputArray[0][3][i]); // height
            const conf = Number(outputArray[0][4][i]); // confidence
            
            // Skip low confidence detections
            if (conf > this.confidenceThreshold) {
              // Convert normalized coordinates to pixels
              // YOLOv8 outputs center coordinates, convert to top-left
              const boxX = (x - w/2) * imageDims.inputSize;
              const boxY = (y - h/2) * imageDims.inputSize;
              const boxWidth = w * imageDims.inputSize;
              const boxHeight = h * imageDims.inputSize;
              
              // Convert from padded image back to original video coordinates
              const originalX = (boxX - imageDims.leftPadding) / imageDims.scale;
              const originalY = (boxY - imageDims.topPadding) / imageDims.scale;
              const originalWidth = boxWidth / imageDims.scale;
              const originalHeight = boxHeight / imageDims.scale;
              
              // Calculate aspect ratio
              const aspectRatio = originalWidth / originalHeight;
              
              // Add to detections
              detections.push({
                box: {
                  x: originalX,
                  y: originalY,
                  width: originalWidth,
                  height: originalHeight
                },
                confidence: conf,
                aspectRatio: aspectRatio,
                alignmentScore: this.calculateAlignmentScore(aspectRatio, originalWidth * originalHeight, {
                  originalWidth: imageDims.originalWidth,
                  originalHeight: imageDims.originalHeight
                })
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error processing YOLOv8 output:", error);
    }
    
    // Sort by confidence (highest first)
    return detections.sort((a, b) => b.confidence - a.confidence);
  }
  
  private calculateAlignmentScore(aspectRatio: number, area: number, imageDims: { originalWidth: number, originalHeight: number }): number {
    // Ideal aspect ratio for Ghana Card (85.6mm × 54mm)
    const idealAspectRatio = 1.585;
    const aspectRatioTolerance = 0.2;
    
    // Validate inputs to avoid NaN or infinite values
    if (!aspectRatio || !area || area <= 0 || aspectRatio <= 0) {
      return 0;
    }
    
    // Calculate aspect ratio score (how close to ideal)
    const aspectRatioError = Math.abs(aspectRatio - idealAspectRatio) / idealAspectRatio;
    const aspectRatioScore = Math.max(0, 1 - aspectRatioError / aspectRatioTolerance);
    
    // Calculate area score (card should take up a reasonable portion of the frame)
    const totalArea = imageDims.originalWidth * imageDims.originalHeight;
    const areaRatio = area / totalArea;
    
    let areaScore = 0;
    if (areaRatio > 0.03 && areaRatio < 0.9) {
      // Prefer cards that take up some reasonable portion of the frame
      if (areaRatio > 0.08 && areaRatio < 0.7) {
        areaScore = 1.0;
      } else {
        areaScore = 0.7;
      }
    }
    
    // Combined score (weighted 60% aspect ratio, 40% area)
    return aspectRatioScore * 0.6 + areaScore * 0.4;
  }
  
  private drawDetections(detections: Detection[]): void {
    if (!detections || detections.length === 0 || !this.ctx) {
      return;
    }
    
    // Only draw the best detection
    const detection = detections[0];
    const { box, confidence, alignmentScore } = detection;
    
    // Determine color based on alignment score
    let color;
    if (alignmentScore > 0.8) {
      color = 'lime'; // Excellent alignment
    } else if (alignmentScore > 0.5) {
      color = 'yellow'; // Good alignment
    } else {
      color = 'red'; // Poor alignment
    }
    
    // Draw bounding box
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(box.x, box.y, box.width, box.height);
    
    // Draw label background
    const text = `Ghana Card: ${Math.round(confidence * 100)}% (Align: ${Math.round(alignmentScore * 100)}%)`;
    this.ctx.font = 'bold 16px Arial';
    const textWidth = this.ctx.measureText(text).width + 10;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(
      box.x, 
      box.y > 35 ? box.y - 35 : box.y + box.height,
      textWidth,
      30
    );
    
    // Draw label text
    this.ctx.fillStyle = color;
    this.ctx.fillText(
      text,
      box.x + 5,
      box.y > 35 ? box.y - 15 : box.y + box.height + 20
    );
  }
  
  private checkForAutoCapture(detections: Detection[]): void {
    if (!detections || detections.length === 0) {
      this.consecutiveDetections = 0;
      return;
    }
    
    // Only consider the best detection
    const detection = detections[0];
    
    // Check criteria for auto-capture
    if (detection.confidence > this.confidenceThreshold && detection.alignmentScore > 0.5) {
      this.consecutiveDetections++;
      
      // Show progress in status
      this.setStatus(`Card detected - Holding steady: ${this.consecutiveDetections}/${this.minConsecutiveDetections}`, 'status-active');
      
      // When we have enough consecutive good detections, capture the card
      if (this.consecutiveDetections >= this.minConsecutiveDetections) {
        this.captureCard(detection);
        this.consecutiveDetections = 0;
      }
    } else {
      // Reset counter if detection is not good enough
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.setStatus('Auto-capture active: Position card properly in the frame', 'status-active');
    }
  }
  
  public manualCapture(): void {
    if (!this.videoElement || !this.capturedCanvas || !this.capturedCtx) {
      this.setStatus('Video or canvas elements not available', 'status-error');
      return;
    }
    
    const { videoWidth, videoHeight } = this.videoElement;
    
    // Resize captured canvas to match video aspect ratio
    this.capturedCanvas.width = 640;
    this.capturedCanvas.height = Math.round(640 * (videoHeight / videoWidth));
    
    // Draw the current video frame
    this.capturedCtx.drawImage(this.videoElement, 0, 0, this.capturedCanvas.width, this.capturedCanvas.height);
    
    // Enable send button and update status
    if (this.sendBtn) this.sendBtn.disabled = false;
    this.cardCaptured = true;
    
    if (this.captureStatusElement) {
      this.captureStatusElement.textContent = 'Card captured manually';
    }
    
    this.setStatus('Card captured manually', 'status-success');
    
    // Call the onCapture callback with the image data URL if provided
    if (this.onCapture) {
      const imageDataUrl = this.capturedCanvas.toDataURL('image/jpeg');
      this.onCapture(imageDataUrl);
    }
  }
  
  private captureCard(detection: Detection): void {
    if (!this.videoElement || !this.capturedCanvas || !this.capturedCtx) {
      return;
    }
    
    const { box } = detection;
    
    // Calculate the aspect ratio based on standard Ghana Card dimensions
    const cardAspectRatio = 1.585; // 85.6mm / 54mm
    
    // Adjust the height of the cropped area to match the standard aspect ratio
    let adjustedHeight = box.width / cardAspectRatio;
    let adjustedY = box.y + (box.height - adjustedHeight) / 2;
    
    // Ensure adjusted values are valid
    if (adjustedHeight <= 0) adjustedHeight = box.height;
    if (adjustedY < 0) adjustedY = box.y;
    
    // Add a small margin (5%)
    const margin = 0.05;
    const marginX = box.width * margin;
    const marginY = adjustedHeight * margin;
    
    // Define crop area with margin
    const cropX = Math.max(0, box.x - marginX);
    const cropY = Math.max(0, adjustedY - marginY);
    const cropWidth = Math.min(box.width + 2 * marginX, this.videoElement.videoWidth - cropX);
    const cropHeight = Math.min(adjustedHeight + 2 * marginY, this.videoElement.videoHeight - cropY);
    
    // Ensure valid crop dimensions
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error("Invalid crop dimensions:", { cropX, cropY, cropWidth, cropHeight });
      return;
    }
    
    // Resize captured canvas to standard dimensions while maintaining aspect ratio
    this.capturedCanvas.width = 640;
    this.capturedCanvas.height = Math.round(640 / cardAspectRatio);
    
    try {
      // Draw the cropped card to the canvas
      this.capturedCtx.drawImage(
        this.videoElement,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, this.capturedCanvas.width, this.capturedCanvas.height
      );
      
      // Enable send button and update status
      if (this.sendBtn) this.sendBtn.disabled = false;
      this.cardCaptured = true;
      
      if (this.captureStatusElement) {
        this.captureStatusElement.textContent = 'Card auto-captured successfully';
      }
      
      this.setStatus('Ghana Card auto-captured successfully!', 'status-success');
      
      // Call the onCapture callback with the image data URL if provided
      if (this.onCapture) {
        const imageDataUrl = this.capturedCanvas.toDataURL('image/jpeg');
        this.onCapture(imageDataUrl);
      }
    } catch (error: any) {
      console.error("Error capturing card:", error);
      this.setStatus(`Error capturing card: ${error.message}`, 'status-error');
    }
  }
  
  public sendToBackend(apiUrl: string = 'https://backend-api.com/verify'): Promise<any> {
    if (!this.cardCaptured || !this.capturedCanvas) {
      this.setStatus('No card captured yet', 'status-warning');
      return Promise.reject(new Error('No card captured yet'));
    }
    
    this.setStatus('Sending card to backend for verification...', 'status-loading');
    
    return new Promise((resolve, reject) => {
      // Convert canvas to blob
      this.capturedCanvas.toBlob(blob => {
        if (!blob) {
          const error = new Error('Could not convert canvas to blob');
          this.setStatus(`Error: ${error.message}`, 'status-error');
          reject(error);
          return;
        }
        
        // Create form data for the API request
        const formData = new FormData();
        formData.append('card_image', blob, 'ghana_card.jpg');
        
        // Send to backend
        fetch(apiUrl, {
          method: 'POST',
          body: formData
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // Handle successful response
          this.setStatus(`Verification successful! Card is ${data.valid ? 'valid' : 'invalid'}`, 'status-success');
          
          if (this.captureStatusElement) {
            this.captureStatusElement.textContent = `Verification result: ${data.valid ? 'Valid' : 'Invalid'} Ghana Card`;
          }
          
          resolve(data);
        })
        .catch(error => {
          // Handle errors
          console.error('Error sending to backend:', error);
          this.setStatus(`Error sending to backend: ${error.message}`, 'status-error');
          
          if (this.captureStatusElement) {
            this.captureStatusElement.textContent = 'Error during verification';
          }
          
          reject(error);
        });
      }, 'image/jpeg', 0.95);
    });
  }
  
  public setStatus(message: string, className: string = ''): void {
    if (!this.statusElement) return;
    
    this.statusElement.textContent = message;
    
    // Remove all status classes
    this.statusElement.classList.remove(
      'status-loading', 
      'status-success', 
      'status-error', 
      'status-warning',
      'status-active'
    );
    
    // Add the new class if provided
    if (className) {
      this.statusElement.classList.add(className);
    }
    
    // Call the onStatusChange callback if provided
    if (this.onStatusChange) {
      this.onStatusChange(message, className);
    }
  }
  
  private setModelStatus(message: string): void {
    if (!this.modelStatusElement) return;
    this.modelStatusElement.textContent = message;
  }
  
  // Public getters
  public isModelLoaded(): boolean {
    return this.modelLoaded;
  }
  
  public isCameraActive(): boolean {
    return this.cameraActive;
  }
  
  public isAutoCapture(): boolean {
    return this.autoCapture;
  }
  
  public isCardCaptured(): boolean {
    return this.cardCaptured;
  }
  
  // Get the captured card as a data URL
  public getCapturedCardDataUrl(format: string = 'image/jpeg', quality: number = 0.95): string | null {
    if (!this.cardCaptured || !this.capturedCanvas) {
      return null;
    }
    
    return this.capturedCanvas.toDataURL(format, quality);
  }
}

export default GhanaCardDetector;