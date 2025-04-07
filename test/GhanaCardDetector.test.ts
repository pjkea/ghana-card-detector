import GhanaCardDetector from '../src/GhanaCardDetector';
import * as tf from '@tensorflow/tfjs';
import * as tflite from '@tensorflow/tfjs-tflite';

describe('GhanaCardDetector', () => {
  let detector: GhanaCardDetector;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new detector instance
    detector = new GhanaCardDetector({
      modelPath: 'test/model.tflite',
      confidenceThreshold: 0.8,
      minConsecutiveDetections: 2
    });
  });
  
  afterEach(() => {
    // Clean up after each test
    if (detector && detector.isCameraActive()) {
      detector.stopCamera();
    }
  });
  
  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(detector).toBeDefined();
      expect(detector.isModelLoaded()).toBe(false);
      expect(detector.isCameraActive()).toBe(false);
      expect(detector.isAutoCapture()).toBe(false);
      expect(detector.isCardCaptured()).toBe(false);
    });
    
    it('should load the model during initialization', async () => {
      await detector.initialize();
      
      expect(tf.ready).toHaveBeenCalled();
      expect(tflite.loadTFLiteModel).toHaveBeenCalledWith('test/model.tflite');
      expect(detector.isModelLoaded()).toBe(true);
    });
    
    it('should handle initialization errors', async () => {
      // Mock TensorFlow.js ready to reject
      (tf.ready as jest.Mock).mockRejectedValueOnce(new Error('TF initialization error'));
      
      await expect(detector.initialize()).rejects.toThrow('TF initialization error');
      expect(detector.isModelLoaded()).toBe(false);
    });
  });
  
  describe('Camera Controls', () => {
    beforeEach(async () => {
      // Initialize the detector for camera tests
      await detector.initialize();
    });
    
    it('should start the camera', async () => {
      await detector.startCamera();
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      expect(detector.isCameraActive()).toBe(true);
    });
    
    it('should stop the camera', async () => {
      await detector.startCamera();
      detector.stopCamera();
      
      expect(detector.isCameraActive()).toBe(false);
    });
    
    it('should toggle auto-capture mode', async () => {
      await detector.startCamera();
      expect(detector.isAutoCapture()).toBe(true); // Auto-enabled in startCamera
      
      detector.toggleAutoCapture();
      expect(detector.isAutoCapture()).toBe(false);
      
      detector.toggleAutoCapture();
      expect(detector.isAutoCapture()).toBe(true);
    });
  });
  
  describe('Card Detection and Capture', () => {
    beforeEach(async () => {
      await detector.initialize();
      await detector.startCamera();
    });
    
    it('should manually capture a card', () => {
      // Spy on internal methods
      const mockOnCapture = jest.fn();
      detector = new GhanaCardDetector({
        onCapture: mockOnCapture
      });
      
      detector.manualCapture();
      
      expect(detector.isCardCaptured()).toBe(true);
      expect(mockOnCapture).toHaveBeenCalled();
    });
    
    it('should process detections', async () => {
      // This is a more complex test that requires mocking the private methods
      // For simplicity, we'll just test if the main detection flow works
      
      // Manually trigger a detection cycle (this would normally happen in requestAnimationFrame)
      // We need to access private method, which is a bit hacky for testing
      const detectMethod = (detector as any).detectCard.bind(detector);
      await detectMethod();
      
      // Since we've mocked TF to return a high confidence detection
      // We expect the consecutive detections counter to increase
      expect((detector as any).consecutiveDetections).toBeGreaterThan(0);
    });
    
    it('should get the captured card as data URL', () => {
      detector.manualCapture();
      const dataUrl = detector.getCapturedCardDataUrl();
      
      expect(dataUrl).toContain('data:image/jpeg;base64');
    });
  });
  
  describe('API Integration', () => {
    beforeEach(async () => {
      await detector.initialize();
      detector.manualCapture(); // Ensure a card is captured
    });
    
    it('should send the captured card to backend API', async () => {
      const response = await detector.sendToBackend('https://api.test.com/verify');
      
      expect(fetch).toHaveBeenCalledWith('https://api.test.com/verify', expect.any(Object));
      expect(response).toEqual({ valid: true });
    });
    
    it('should handle API errors', async () => {
      // Mock fetch to reject
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(detector.sendToBackend()).rejects.toThrow('Network error');
    });
  });
  
  describe('Status Updates and Callbacks', () => {
    it('should update status with proper CSS classes', () => {
      const mockOnStatusChange = jest.fn();
      detector = new GhanaCardDetector({
        onStatusChange: mockOnStatusChange
      });
      
      detector.setStatus('Test status', 'status-success');
      
      expect(mockOnStatusChange).toHaveBeenCalledWith('Test status', 'status-success');
    });
    
    it('should trigger onCapture callback when capturing a card', () => {
      const mockOnCapture = jest.fn();
      detector = new GhanaCardDetector({
        onCapture: mockOnCapture
      });
      
      detector.manualCapture();
      
      expect(mockOnCapture).toHaveBeenCalled();
      expect(mockOnCapture.mock.calls[0][0]).toContain('data:image/jpeg;base64');
    });
  });
});

