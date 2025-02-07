import { Mesh, MeshBasicMaterial, PlaneGeometry, Texture, TextureLoader } from 'three';

import { EventEmitter } from 'events';
import genAiRequestJson from './genAIRequest.json';
import { globals } from './global';

const urlParams = new URLSearchParams(new URL(window.location.href).search);
const REPLICATE_API_TOKEN = urlParams.get('token');

var transparantMaterial = new MeshBasicMaterial({
  map: new Texture(),
  transparent: true,
});

var screenShotTextPlane = new Mesh(new PlaneGeometry(1, 0.5), transparantMaterial);
screenShotTextPlane.position.set(1, 1.65, -2);
screenShotTextPlane.visible = false;
var roomCaptureTextPlane = new Mesh(new PlaneGeometry(2, 0.5), transparantMaterial);
roomCaptureTextPlane.position.set(-2, 1.8, -2);
roomCaptureTextPlane.visible = false;

var screenShotPlane;

export function takeScreenshot() {
    const { ratk, scene } = globals;
    // Add color to planes
    ratk.planes.forEach((plane) => {
      console.log('Iterating planes with orientation ' + plane.orientation + ' label ' + plane.semanticLabel);
      if (plane.orientation === 'vertical' || plane.semanticLabel === 'floor') {
        plane.visible = true;
      }
    });


    globals.panelAnchor.visible = false;
    const targetMarkerVisibility = globals.targetMarker.visible;
    globals.targetMarker.visible = false;

    if (screenShotPlane) {
      screenShotPlane.visible = false;
      screenShotTextPlane.visible = false;
    }

    const xrRefSpace = globals.renderer.xr.getReferenceSpace();
		const xrFrame = globals.renderer.xr.getFrame();
		const viewerPose = xrFrame.getViewerPose(xrRefSpace);
		globals.photoCamera.position.copy(viewerPose.transform.position);
		globals.photoCamera.quaternion.copy(viewerPose.transform.orientation);
		globals.photoRenderer.render(globals.scene, globals.photoCamera);

    // Create a new texture from the canvas
    const texture = new Texture(globals.photoRenderer.domElement);
    texture.needsUpdate = true;
    const material = new MeshBasicMaterial({ map: texture});
  
    if (!screenShotPlane) {
      const geometry = new PlaneGeometry(1, 1); // adjust size as needed
      screenShotPlane = new Mesh(geometry, material);
      // Add the plane to the scene
      scene.add(screenShotPlane);
      // Position the plane in front of the camera
      screenShotPlane.position.set(1, 1, -2);

      globals.scene.add(screenShotTextPlane);
      globals.scene.add(roomCaptureTextPlane);
    } else {
      screenShotPlane.material = material;
    }
    
    displayText('Your Room Capture', screenShotTextPlane);

    ratk.planes.forEach((plane) => {
      plane.visible = false;
    });
  
    globals.panelAnchor.visible = true;
    globals.targetMarker.visible = targetMarkerVisibility;
    screenShotPlane.visible = true;
    screenShotTextPlane.visible = true;
    
    globals.snapshotCanvas = globals.photoRenderer.domElement;
  }

  // Convert the canvas to a Blob
  function canvasToBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  export async function triggerGenAIFlow() {    
    displayText('Generating Your AI Room Layout', roomCaptureTextPlane);
    roomCaptureTextPlane.visible = true;

    const uploadedUrl = await uploadImageToTmpFiles(globals.snapshotCanvas);

    const url = new URL(uploadedUrl);
    // Add a subdirectory right after the domain
    const subdirectory = 'dl';
    url.pathname = `/${subdirectory}${url.pathname}`;
    // Convert the URL object back to a string
    const modifiedUrl = url.toString();
    console.log('Modified URL:', modifiedUrl);

    return await generateAiPhoto(modifiedUrl);
  }
  
  // Upload the image to tmpfiles.org
  async function uploadImageToTmpFiles(canvas) {
    try {
      const blob = await canvasToBlob(canvas);
      const formData = new FormData();
      formData.append('file', blob, 'snapshot.png');
      const response = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      const result = await response.json();
      console.log('Uploaded Image URL:', result.data.url);
      return result.data.url;
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  }

   async function generateAiPhoto(inputImageUrl) {
    genAiRequestJson.input.controlnet_1_image = inputImageUrl;

    const headers = {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
    };

    console.log('loaded json ' + JSON.stringify(genAiRequestJson));
    // Make the POST request
    fetch('http://localhost:3000/api/v1/predictions', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(genAiRequestJson),
    })
    .then(async response => {
      if (!response.ok) {
          const errData = await response.json();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${JSON.stringify(errData)}`);
          }
          return response.json();
      })
    .then(data => {
        // console.log('Response Data:', data);
        console.log('Got GenAI Job ID:', data.id);
        globals.waitingGenAIResult = data.id;
        
        const myEmitter = new EventEmitter();
        const intervalId = startChecking('http://localhost:3000/api/v1/predictions/' + data.id, myEmitter);

        // // Event listener for 'outputNotEmpty'
        myEmitter.on('outputNotEmpty', (output) => {
          console.log('Output is not empty:', output);
          displayOutputImage(output);
          clearInterval(intervalId);
        });

        return data.id;
    })
    .catch(error => {
        console.error('Error:', error);
    });
}


  // Function to periodically check the condition
  export function startChecking(url, myEmitter) {
    return setInterval(async () => {
      const result = await getGenAiResult(url);
      if (result && result.output && result.output.length > 0) {
        // Emit an event when the condition is met
        myEmitter.emit('outputNotEmpty', result.output);
      }
    }, 4000); // 1000 milliseconds = 1 second
  }
  
  
  // Function to make a GET request
  async function getGenAiResult(url) {
    const headers = {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
    };
    
    try {
      const response = await fetch(url, { headers: headers });
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching data:', error);
      return null;
    }
  }
  
  export function displayOutputImage(output) {
    output.forEach((url, i) => {
        if (i == 0) return;

        const textureLoader = new TextureLoader();
        const texture = textureLoader.load(url);

        const material = new MeshBasicMaterial({ map: texture });
        const geometry = new PlaneGeometry(1, 1); // adjust size as needed
        const plane = new Mesh(geometry, material);
        plane.position.set(1.2*i-5, 1, -2);
        // Add the plane to the scene
        globals.scene.add(plane);
    })

    displayText('Your AI Room Layout', roomCaptureTextPlane);
  }

  function displayText(testInput, textPlane) {
    const textCanvas = document.createElement('canvas');
    // Get the 2D drawing context of the canvas
    const ctx = textCanvas.getContext('2d');
    // Set the font and text color
    ctx.font = '20px Arial';
    ctx.fontWeight = 'extra-bold'
    ctx.fillStyle = '#ffffff';
    // Draw the text on the canvas
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';    
    ctx.fillText(testInput, textCanvas.width / 2, textCanvas.height / 2);

     // Create a new material with the texture
     const textTexture = new Texture(textCanvas);
     textTexture.needsUpdate = true;
     const textMaterial = new MeshBasicMaterial({ map: textTexture, transparent: true  });
     textPlane.material = textMaterial;
  }