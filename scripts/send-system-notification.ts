#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import inquirer from "inquirer";
import chalk from "chalk";

const prisma = new PrismaClient();

async function sendSystemNotification() {
	console.log(chalk.bgHex("#406ae1").white.bold(" Send System Notification "));
	console.log("");

	const answers = await inquirer.prompt([
		{
			type: "list",
			name: "icon",
			message: "Icon:",
			choices: [
				{
					name: "💬\tAnnouncement",
					value: "notification"
				},
				{
					name: "🚨\tAlert",
					value: "alert"
				},
				{
					name: "🛡️\tModeration",
					value: "moderation"
				}
			]
		},
		{
			type: "input",
			name: "title",
			message: "Title:",
			validate: (input: string) => {
				if (!input.trim()) {
					return "Title is required";
				}
				return true;
			}
		},
		{
			type: "editor",
			name: "message",
			message: "Message (Markdown supported):",
			validate: (input: string) => {
				if (!input.trim()) {
					return "Message is required";
				}
				return true;
			}
		},
		{
			type: "confirm",
			name: "confirm",
			message: "Ready to send to all users?",
			default: false
		}
	]);

	if (!answers.confirm) {
		console.log(chalk.yellow("Cancelled"));
		return;
	}

	try {
		await prisma.systemNotification.create({
			data: {
				icon: answers.icon,
				title: answers.title,
				message: answers.message
			}
		});

		console.log(chalk.green.bold("Notification sent"));
	} catch (error) {
		console.error(chalk.red("Failed to create system notification:"), error);
		process.exit(1);
	}
}

try {
	await sendSystemNotification();
	await prisma.$disconnect();
	process.exit(0);
} catch (error) {
	console.error(chalk.red("Error:"), error);
	await prisma.$disconnect();
	process.exit(1);
}
