/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, TextureLoader, Vector3 } from 'three';

import { GamepadWrapper } from 'gamepad-wrapper';
import { System } from 'elics';
import { globals } from './global';

/**
 * PlayerSystem manages the player's interactions and updates in the game.
 */
export class PlayerSystem extends System {
	init() {
		this._vec3 = new Vector3();

		const { renderer, camera, scene } = globals;
		const controllers = {};
		scene.add(camera);

		for (let i = 0; i < 2; i++) {
			const controllerGrip = renderer.xr.getControllerGrip(i);
			scene.add(controllerGrip);
			const targetRaySpace = renderer.xr.getController(i);
			targetRaySpace.addEventListener('connected', async function (event) {
				this.handedness = event.data.handedness;
				const gamepadWrapper = new GamepadWrapper(event.data.gamepad);
				controllers[event.data.handedness] = {
					targetRaySpace: targetRaySpace,
					gripSpace: controllerGrip,
					gamepadWrapper: gamepadWrapper,
				};
				scene.add(targetRaySpace, controllerGrip);
			});
			targetRaySpace.addEventListener('disconnected', function () {
				delete controllers[this.handedness];
			});
			scene.add(targetRaySpace);
		}

		const playerHead = new Group();
		scene.add(playerHead);
		globals.playerHead = playerHead;
		globals.controllers = controllers;
	}

	update() {
		Object.values(globals.controllers).forEach((controllerObject) => {
			if (controllerObject) controllerObject.gamepadWrapper.update();
		});
		const xrManager = globals.renderer.xr;
		const frame = xrManager.getFrame();
		const pose = frame?.getViewerPose(xrManager.getReferenceSpace());
		if (pose) {
			const headsetMatrix = new Matrix4().fromArray(
				pose.views[0].transform.matrix,
			);
			headsetMatrix.decompose(
				globals.playerHead.position,
				globals.playerHead.quaternion,
				this._vec3,
			);

			if (globals.snapshot) {
				takeScreenshot();
				globals.snapshot = false;
			}
		}
	}
}


function takeScreenshot() {
	const { camera, offScreenRenderTarget, ratk, renderer, scene } = globals;
	// Add color to planes
	ratk.planes.forEach((plane) => {
		// scene.add(plane.planeMesh);
		// Process each plane
		plane.visible = true;
		console.log('Iterating planes with orientation ' + plane.orientation + ' label ' + plane.semanticLabel);
		const textureLoader = new TextureLoader();
		
		if (plane.orientation === 'vertical') {
			textureLoader.load('assets/textures/white_plaster_02_diff_4k.jpg', (newTexture) => {
				newTexture.wrapS = RepeatWrapping;
				newTexture.wrapT = RepeatWrapping;
				newTexture.repeat.set(1, 1); // Adjust these values as needed
				// Update the material's map with the new texture
				plane.planeMesh.material.map = newTexture;
				plane.planeMesh.material.color.setHex( 0xffffff );
				plane.planeMesh.material.needsUpdate = true; // Ensure the material is updated
			});
		} else if (plane.semanticLabel === 'floor')  {
			textureLoader.load('assets/textures/wood_floor_texture.jpg', (newTexture) => {
				newTexture.wrapS = RepeatWrapping;
				newTexture.wrapT = RepeatWrapping;
				newTexture.repeat.set(1, 1); // Adjust these values as needed
				// Update the material's map with the new texture
				plane.planeMesh.material.map = newTexture;
				plane.planeMesh.material.needsUpdate = true; // Ensure the material is updated
			});
		} 
		// else {
		// 	plane.planeMesh.material.color.setHex( 0x101a00 );
		// }

		// console.log(plane);
	});

	renderer.setRenderTarget(offScreenRenderTarget);
	renderer.render(scene, camera);
	renderer.setRenderTarget(null); // Reset to default render target

	const material = new MeshBasicMaterial({ map: offScreenRenderTarget.texture });
	const geometry = new PlaneGeometry(1, 1); // adjust size as needed
	const plane = new Mesh(geometry, material);
	// Add the plane to the scene
	scene.add(plane);
	// Position the plane in front of the camera
	plane.position.set(1, 1, -2);

	ratk.planes.forEach((plane) => {
		plane.visible = false;
	});
  }