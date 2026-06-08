# MIG-WELDSIGHT_AI

Industrial AI Platform for Real-Time MIG Welding Monitoring and Anomaly Detection

---

## Overview

MIG-WELDSIGHT_AI is an industrial intelligence platform designed for real-time monitoring, anomaly detection, and process visualization in Manual MIG Welding environments.

The platform combines:

- Deep Learning Based Anomaly Detection
- Feature Engineered Welding Intelligence
- Real-Time Streaming Visualization
- Industrial Dashboard Monitoring
- Upload + Live Monitoring Modes
- Cluster-Based Process State Analysis

The system transforms raw welding voltage streams into interpretable process intelligence for detecting abnormal welding behavior.

---

## System Architecture

```text
Voltage Acquisition System
            ↓
Signal Preprocessing
            ↓
Window Segmentation
            ↓
23 Feature Extraction Pipeline
            ↓
VAE-Based Reconstruction Models
            ↓
Anomaly Detection Pipeline
            ↓
Classification Engine
            ↓
Frontend Dashboard Visualization
```

---

## Core Features

### Real-Time Monitoring

- Live voltage stream monitoring
- WebSocket-based data ingestion
- Continuous anomaly detection
- Dynamic graph updates

### Upload Mode

- Upload raw MIG voltage CSV files
- Automatic inference pipeline
- Batch anomaly detection

### Deep Learning Detection

- Variational Autoencoder (VAE) architecture
- Reconstruction-based anomaly scoring
- Dynamic thresholding

### Welding Intelligence Features

23 engineered welding features including:

- Mean
- RMS
- Variance
- Crest Factor
- Spectral Entropy
- Dominant Frequency
- Spike Density
- Stability Index
- Short Circuit Metrics
- Spectral Centroid
- Energy Metrics

### Process State Classification

Current process states:

- Normal
- Arc Instability
- Transfer Change
- Short Circuit Abnormality

### Cluster-Based Process Analysis

Feature embedding visualization using:

- PCA Projection
- DBSCAN Clustering

Normal welding behavior forms dense clusters.

Anomalies appear as isolated outliers.

---

## Dashboard Components

### Weld Process Monitoring

Displays:

- Reconstruction score evolution
- Threshold boundaries
- Anomaly regions
- Rolling live updates

### Process State Separation

Visualizes:

- Cluster formation
- Outlier detection
- Process behavior transitions

### Metrics Panel

Displays:

- Windows Processed
- Total Anomalies
- Live Status
- Threshold Value

---

## Technology Stack

### Frontend

- React
- TypeScript
- Recharts
- Framer Motion
- WebSockets
- Vite

### Backend

- Python
- PyTorch
- NumPy
- Pandas
- SciPy
- FastAPI

### ML Stack

- Variational Autoencoders
- DBSCAN
- PCA
- Scikit-Learn

### Deployment

- Lovable
- GitHub
- Vercel

---

## Repository Structure

```text
frontend/
│
├── components/
├── charts/
├── websocket/
├── services/
├── pages/

backend/
│
├── models/
├── feature_engineering/
├── inference/
├── streaming/
├── preprocessing/

saved_models/
│
├── vae_models/
├── scalers/
├── classifiers/

results/
```

---

## Running Locally

### Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/MIG-WELDSIGHT_AI.git

cd MIG-WELDSIGHT_AI
```

### Frontend

```bash
npm install

npm run dev
```

### Backend

```bash
pip install -r requirements.txt

python app.py
```

---

## Deployment

Frontend:

- Vercel

Backend:

- FastAPI Server
- Railway / Local Deployment

---

## Real-Time Pipeline

```text
Manual MIG Welding

↓

Voltage Feed

↓

Streaming Backend

↓

Inference Pipeline

↓

WebSocket Transmission

↓

Dashboard Update

↓

Anomaly Visualization
```

---

## Research Motivation

Manual welding processes generate highly dynamic electrical signatures.

Traditional inspection methods:

- Are post-process
- Require human interpretation
- Miss transient process behavior

MIG-WELDSIGHT_AI aims to transform welding into a continuously monitored intelligent process.

---

## Current Status

- Frontend Dashboard Complete
- Upload Mode Operational
- Live Mode Operational
- VAE Pipeline Trained
- GitHub Deployment Enabled
- Vercel Deployment Enabled
- Real-Time Streaming Integration In Progress

---

## Future Scope

- Multi-sensor Fusion
- Current + Voltage Integration
- Transfer Mode Recognition
- Physics-Informed Models
- Edge Deployment
- Industrial PLC Integration

---

## Author

### Raagmanas Madhukar

Project Intern @ Centre of Excellence in Advanced Manufacturing Technology, Indian Institute of Technology Kharagpur  

Electronics Engineering (VLSI Design & Technology) @ Manipal Institute of Technology  

Industrial AI | Embedded Systems | Autonomous Systems | Smart Manufacturing | Welding Intelligence
