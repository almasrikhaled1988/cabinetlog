# Proof of Concept — WerkFlow Build Guide Demo

## Overview
A complete proof of concept build guide has been created for a Variable Speed Drive (VSD) cabinet assembly. This guide is ready for presentation to stakeholders.

## Access Information

### Frontend (Web Application)
- **Local URL:** http://localhost:3000
- **Network URL:** http://192.168.0.136:3000

### Backend (API Server)
- **URL:** http://localhost:4000
- **Status:** Running

## Login Credentials

### Admin Account (Full Access)
- **Email:** admin@werkflow.local
- **Password:** changeme123

### Worker Account (View Guide)
- **Email:** worker@werkflow.local
- **Password:** worker123

## Demo Guide Details

**Guide Title:** VSD Cabinet Assembly — Complete Build Guide

**Cabinet Type:** VSD (Variable Speed Drive)  
**Drive Model:** ATV630

**Steps Included:** 8

1. **Backplate Preparation & Layout** (15 min)
   - Inspect backplate, mark mounting positions
   - Warning: Wear safety glasses when drilling

2. **DIN Rail & Cable Duct Installation** (20 min)
   - Mount DIN rails, install cable ducts
   - Warning: Ensure rails are level before final tightening

3. **Main Component Mounting** (25 min)
   - Install circuit breaker, contactors, relays
   - Warning: Check component orientation for proper cooling

4. **Drive Unit Installation** (30 min)
   - Mount VSD unit, connect cooling system
   - Warning: Handle carefully — heavy and ESD sensitive

5. **Power Wiring & Bus Bar Connections** (45 min)
   - Connect main power cables, bus bars
   - Warning: VERIFY POWER IS DISCONNECTED before wiring

6. **Control Wiring & Signal Connections** (60 min)
   - Connect control signals, communication cables
   - Warning: Keep 100mm separation between power and control cables

7. **Cable Management & Dressing** (30 min)
   - Organize cables, apply ties, install strain relief

8. **Final Inspection & Testing** (25 min)
   - Visual inspection, torque checks, insulation tests
   - Warning: Complete ALL checks before applying power

**Total Estimated Time:** 250 minutes (4 hours 10 minutes)

## Features Demonstrated

✅ Image uploads to Cloudinary  
✅ Build step creation with estimated time  
✅ Warning notes for safety-critical steps  
✅ Professional assembly sequence  
✅ Real photos from the assembly process  
✅ Worker-friendly step-by-step instructions  

## How to Present

1. **Open the frontend** in a browser: http://localhost:3000
2. **Login as admin** to view the complete guide
3. **Navigate to the demo guide** or search for "VSD Cabinet Assembly"
4. **Show each step** with its associated image
5. **Demonstrate worker view** (limited functionality) by logging out and logging in as worker@werkflow.local
6. **Highlight safety warnings** and estimated timing

## Technical Details

- **MongoDB:** Running locally on port 27017
- **Cloudinary:** Images stored at https://cloudinary.com/console
- **Backend:** TypeScript with Node.js
- **Frontend:** Vue 3 + Vite + Tailwind CSS

## To Stop the Servers

```bash
# Kill all node processes
pkill -f "node"
```

Or simply close the terminal windows.

---

**Status:** ✅ Ready for Presentation  
**Last Updated:** 2025-05-23
