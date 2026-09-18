---
title: "Three Hacktron Researchers Used Anthropic’s Claude to Break into OpenAI in Under 72 Hours"
description: "A small security team leveraged a corrupted image file and Anthropic’s new Claude model to infiltrate OpenAI’s employee accounts and access its GitHub repository. The incident revealed a flaw in Discourse’s HEIF image handling, prompted a rapid patch, and earned the researchers $6,500 from OpenAI."
slug: "three-hacktron-researchers-used-anthropic-s-claude-to-break-into-openai-in-under-72-hours"
category: "Digital Life"
author: "Tejendra Pal Singh"
publishedAt: "2026-09-18T20:55:55.712Z"
---

## The Quick‑Fire Breach
A trio of security researchers from Hacktron announced that they had breached OpenAI employee accounts in less than three days. The team employed Anthropic’s Claude Opus 4.8 and 5 to carry out the attack. The breach occurred through Discourse, the forum platform that hosts OpenAI’s community boards, by exploiting a flaw in the system that processes HEIF images.

## How the Attack Played Out
The researchers began by uploading a corrupted HEIF image to Discourse, which triggered a remote‑code‑execution vulnerability. Claude Opus 5 was launched on the evening of July 24th, and by 10 AM the following day the team had used it to execute RCE on Discourse Cloud, gaining access to OpenAI’s instance. They then used an employee’s Codex account to submit a pull request to OpenAI’s GitHub repository, called “Monorepo,” which reportedly holds OpenAI’s algorithmic secrets. Although they stopped short of pulling internal code, the pull request served as proof that they had achieved access.

## The HEIF Heist Project
Hacktron’s project, dubbed “HEIF Heist,” reportedly required only one or two days to adapt to multiple organizations, including OpenAI, Slack, Meta, GitHub Enterprise, Rails, Next.js, ImageMagick, and others. The team used fewer than $3,000 in tokens for the attack and, to their knowledge, the flaw was detected by only one target, Shopify. The vulnerability was reported to both Discourse and OpenAI, and the companies have since patched the issue.

## Compensation and Perspective
OpenAI paid Hacktron $6,500 for discovering the bug. Hacktron’s chief technology officer, Mohan Pedhapati, told the Wall Street Journal that the team does not see themselves as matching the capabilities of large state‑run threat actors. “We’re just three guys with Claude and Codex subscriptions,” he said.

## What It Means for Security
The incident underscores how quickly a new AI model can be repurposed for malicious activity when paired with a software flaw. It also highlights the importance of securing image‑processing pipelines, especially in third‑party services that handle user uploads. The rapid response from Discourse and OpenAI—fixing the vulnerability and compensating the researchers—demonstrates a growing trend of responsible disclosure and bug bounty engagement.

Readers should note that the researchers did not access the internal code of OpenAI’s Monorepo; they only demonstrated that they could gain access to employee accounts and submit a pull request. The incident also illustrates the potential for AI tools to accelerate vulnerability exploitation, a development that may prompt tighter controls on how such models are deployed and accessed by developers and researchers alike.

## Sources

- [Security researchers used Claude to help them hack into OpenAI](https://www.theverge.com/ai-artificial-intelligence/997444/openai-hack-claude-heif-heist)
