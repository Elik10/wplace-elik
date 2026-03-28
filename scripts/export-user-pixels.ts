#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import { COLOR_PALETTE } from "../src/utils/colors.js";

const prisma = new PrismaClient();

async function main() {
	const answers = await inquirer.prompt([
		{
			type: "input",
			name: "userId",
			message: "User ID:",
			validate: (input) => {
				const id = Number.parseInt(input);
				if (Number.isNaN(id) || id <= 0) {
					return "Invalid user id";
				}
				return true;
			}
		},
		{
			type: "input",
			name: "outDir",
			message: "Output path:",
			default: "/tmp/openplace-user-pixels",
			validate: (input) => {
				if (!input || input.trim().length === 0) {
					return "Invalid path";
				}
				return true;
			}
		}
	]);

	const userID = Number.parseInt(answers.userId);
	const outDir = path.resolve(process.cwd(), answers.outDir);

	const user = await prisma.user.findUnique({
		where: { id: userID }
	});

	if (!user) {
		console.error(`User ${userID} not found.`);
		process.exit(1);
	}

	console.log(`User: ${user.name}#${user.id}`);

	if (!fs.existsSync(outDir)) {
		console.log(`Creating output directory: ${outDir}`);
		fs.mkdirSync(outDir, { recursive: true });
	}

	console.log("Fetching pixels...");
	const pixels = await prisma.pixel.findMany({
		where: {
			paintedBy: user.id
		},
		select: {
			x: true,
			y: true,
			tileX: true,
			tileY: true,
			colorId: true
		}
	});

	if (pixels.length === 0) {
		throw new Error("User has not painted any pixels");
	}

	// Group by tile
	const tileMap = new Map<string, typeof pixels>();
	for (const pixel of pixels) {
		const key = `${pixel.tileX},${pixel.tileY}`;
		if (!tileMap.has(key)) {
			tileMap.set(key, []);
		}
		tileMap.get(key)!.push(pixel);
	}

	console.log(`User has painted ${pixels.length.toLocaleString()} pixels across ${tileMap.size.toLocaleString()} tiles`);

	// Draw each tile
	let i = 0;
	for (const [key, tilePixels] of tileMap.entries()) {
		const canvas = createCanvas(1000, 1000);
		const ctx = canvas.getContext("2d");
		const imageData = ctx.createImageData(1000, 1000);

		for (const pixel of tilePixels) {
			const color = COLOR_PALETTE[pixel.colorId];
			if (!color) continue;
			if (pixel.colorId === 0) continue;

			const [r, g, b] = color.rgb;
			const index = (pixel.y * 1000 + pixel.x) * 4;
			imageData.data[index + 0] = r;
			imageData.data[index + 1] = g;
			imageData.data[index + 2] = b;
			imageData.data[index + 3] = 255;
		}
		ctx.putImageData(imageData, 0, 0);

		const buffer = canvas.toBuffer("image/png");
		fs.writeFileSync(path.join(outDir, `user${user.id}_tile_${key}.png`), buffer);

		i++;
		process.stdout.write(`\rProcessed ${i}/${tileMap.size} tiles`);
	}

	console.log("\nDone");
	await prisma.$disconnect();
}

try {
	await main();
} finally {
	await prisma.$disconnect();
}
