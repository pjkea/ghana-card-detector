// Demo script showing how to use GhanaCardDetector
document.addEventListener('DOMContentLoaded', async () => {
    try {
      // Create detector instance with custom options
      const detector = new GhanaCardDetector({
        modelPath: 'models/autocapture.tflite',
        confidenceThreshold: 0.85,
        minConsecutiveDetections: 3,
        
        // Handle captured images
        onCapture: (imageDataUrl) => {
          console.log('Card captured:', imageDataUrl.substring(0, 50) + '...');
          
          // Create an image element from the data URL (for demonstration only)
          const capturedImg = document.createElement('img');
          capturedImg.src = imageDataUrl;
          capturedImg.style.display = 'none';
          document.body.appendChild(capturedImg);
          
          // You could send this image to your server for processing
          // sendToServer(imageDataUrl);
        },
        
        // Handle status changes
        onStatusChange: (message, className) => {
          console.log(`Status changed: ${message} (${className})`);
          
          // Update additional UI elements if needed
          if (className === 'status-success') {
            // Handle success status
          } else if (className === 'status-error') {
            // Handle error status
          }
        }
      });
      
      // Initialize detector
      await detector.initialize();
      
      // Optional: Create custom event listeners for certain actions
      document.getElementById('download-btn')?.addEventListener('click', () => {
        if (detector.isCardCaptured()) {
          const dataUrl = detector.getCapturedCardDataUrl();
          if (dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'ghana_card.jpg';
            link.click();
          }
        } else {
          alert('No card has been captured yet!');
        }
      });
      
      // Optional: Auto-start camera after initialization
      // await detector.startCamera();
      
      console.log('Ghana Card Detector initialized successfully!');
    } catch (error) {
      console.error('Failed to initialize detector:', error);
    }
  });
  
  // Example function to send image to server
  function sendToServer(imageDataUrl) {
    fetch('https://api.example.com/verify-card', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageDataUrl,
        timestamp: new Date().toISOString()
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Server response:', data);
    })
    .catch(error => {
      console.error('Error sending to server:', error);
    });
  }