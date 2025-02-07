/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
	DirectionalLight,
	PCFSoftShadowMap,
	PMREMGenerator,
	PerspectiveCamera,
	SRGBColorSpace,
	Scene,
	WebGLRenderer,
} from "three";

import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { globals } from "./global";
import { reversePainterSortStable } from "@pmndrs/uikit";

const SCREENSHOT_CAMERA_CONSTANTS = {
	CAMERA_FOV: 70,
	CAMERA_PHOTO_RESOLUTION_WIDTH: 1280,
	CAMERA_PHOTO_RESOLUTION_HEIGHT: 720,
};

export const setupScene = () => {
	const scene = new Scene();

	const camera = new PerspectiveCamera(
		50,
		window.innerWidth / window.innerHeight,
		0.1,
		10,
	);

	camera.position.z = 0.2;

	const light = new DirectionalLight(0xffffff, 1);
	light.castShadow = true;
	scene.add(light);

	const renderer = new WebGLRenderer({
		alpha: true,
		antialias: true,
		multiviewStereo: true,
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.xr.enabled = true;
	renderer.setTransparentSort(reversePainterSortStable);
	renderer.localClippingEnabled = true;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;

	const environment = new RoomEnvironment(renderer);
	const pmremGenerator = new PMREMGenerator(renderer);

	scene.environment = pmremGenerator.fromScene(environment).texture;
	scene.environmentIntensity = 1;
	document.body.appendChild(renderer.domElement);

	window.addEventListener("resize", function () {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	const photoCamera = new PerspectiveCamera(
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_FOV,
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_WIDTH /
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_HEIGHT,
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_NEAR,
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_FAR
	);
	scene.add(photoCamera);
	photoCamera.position.set(0, 1.5, 0);

	const photoRenderer = new WebGLRenderer({ antialias: true });
	photoRenderer.setPixelRatio(
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_WIDTH /
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_HEIGHT
	);
	photoRenderer.setSize(
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_WIDTH,
		SCREENSHOT_CAMERA_CONSTANTS.CAMERA_PHOTO_RESOLUTION_HEIGHT
	);
	photoRenderer.outputColorSpace = SRGBColorSpace;

	globals.camera = camera;
	globals.renderer = renderer;
	globals.scene = scene;
	globals.photoCamera = photoCamera;
	globals.photoRenderer = photoRenderer;
};