---
title: "Iranian Strikes Wipe Out Amazon Cloud Data in Bahrain, UAE"
description: "Amazon Web Services confirmed permanent loss of customer data after Iranian drone and missile attacks on data centers in Bahrain and the UAE, exceeding the resilience built into its regional services."
slug: "iranian-strikes-wipe-out-amazon-cloud-data-in-bahrain-uae"
category: "Technology"
author: "Tejendra Pal Singh"
publishedAt: "2026-09-17T09:55:20.528Z"
---

## What Happened: Iranian Strikes Hit Amazon Cloud Infrastructure

On March 1, 2026, Iranian drone strikes damaged Amazon data centers in Bahrain and the United Arab Emirates, according to an AWS dashboard update and a Reuters report. The attacks occurred during the opening days of a war that began after US‑Israeli attacks on Iran on February 28, 2026. A follow‑up missile strike by Iran’s Islamic Revolutionary Guard Corps on July 24 targeted a remaining Amazon data center structure in Bahrain; satellite imagery independently confirmed the damage.

## Impact: Permanent Data Loss and Service Disruption

Six months after the initial strikes, AWS posted an update on September 15, 2026, acknowledging that some war‑damaged facilities could not be restored. The update stated that the damage spanned multiple availability zones and exceeded what AWS regional and multi‑AZ services are designed to withstand. In the United Arab Emirates, data in the mec1‑az2 availability zone was irretrievably lost. In Bahrain, all three availability zones lost access to resources and data, according to the same update. Reuters reported that the strikes inflicted catastrophic damage, and AWS confirmed it was unable to restore access to the affected resources.

## AWS Response: Credits, Migration Guidance, and Recovery Efforts

Following the March attacks, AWS issued $150 million in customer credits and urged customers to migrate workloads to other cloud regions and use remote backups to restore inaccessible resources. The company also suspended billing for customers in the affected regions and has spent the past six months attempting to restore normal operations. The September update described ongoing work to replace affected infrastructure and promised further updates on restoration timelines in the coming months.

## What This Means for Customers and the Cloud Industry

Analysis: The incident shows that geopolitical conflict can breach the redundancy assumptions many cloud users rely on. Even though AWS designs services to survive typical regional outages, the physical destruction of entire data centers exceeded those safeguards. For customers, the lesson reinforces the importance of geographic redundancy and maintaining independent backups outside of conflict zones. The $150 million credit program illustrates AWS’s effort to mitigate immediate financial impact, but it does not replace lost data.

## What to Watch Next

Guidance: Customers should monitor AWS communications for updates on restoration progress and consider additional regions for critical workloads. Organizations may reevaluate their disaster‑recovery strategies to include multiple cloud providers or on‑premises backups in stable regions. Observers will be watching whether further Iranian strikes target remaining cloud infrastructure and how AWS’s infrastructure rebuilding proceeds in the coming months.

## Sources

- [Iran strikes on Amazon data centers caused permanent loss of customer data](https://arstechnica.com/gadgets/2026/09/iran-strikes-on-amazon-data-centers-caused-permanent-loss-of-customer-data/)
