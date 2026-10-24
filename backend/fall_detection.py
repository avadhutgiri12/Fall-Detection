import streamlit as st
import cv2
import tempfile
import time
import smtplib
from email.message import EmailMessage
from ultralytics import YOLO

# --- APP CONFIG ---
st.set_page_config(page_title="School Project: Fall Detection", layout="centered")
st.title("🎓 AI Fall Detection System")
st.markdown("This project uses **YOLOv8 Pose Estimation** to monitor safety in real-time.")

# --- SIDEBAR: SYSTEM SETTINGS ---
st.sidebar.header("🛠️ Admin Settings")
target_email = st.sidebar.text_input("Receiver Email", "your-email@example.com")
conf_level = st.sidebar.slider("AI Confidence Threshold", 0.0, 1.0, 0.6)

# IMPORTANT: For school demos, use a dedicated 'App Password' from Gmail
SENDER_EMAIL = "avadhutgiri143@gmail.com" 
SENDER_PASS = "svvp omtr jzhl jdzc" 

def send_alert(score):
    msg = EmailMessage()
    msg['Subject'] = "🚨 FALL ALERT: Room 101"
    msg['From'] = SENDER_EMAIL
    msg['To'] = target_email
    msg.set_content(f"System detected a fall with {score:.2%}$ confidence. Immediate check required.")
    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(SENDER_EMAIL, SENDER_PASS)
            smtp.send_message(msg)
        return True
    except:
        return False

# --- MODEL LOADING ---
@st.cache_resource
def load_yolo():
    return YOLO('yolov8n-pose.pt')

model = load_yolo()

# --- MAIN INTERFACE ---
tab1, tab2 = st.tabs(["📁 Upload Video", "📸 Live Webcam"])

with tab1:
    uploaded_video = st.file_uploader("Upload a fall test video", type=["mp4", "mov", "avi"])
    if uploaded_video:
        tfile = tempfile.NamedTemporaryFile(delete=False)
        tfile.write(uploaded_video.read())
        
        cap = cv2.VideoCapture(tfile.name)
        frame_window = st.empty()
        
        last_mail = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # AI Inference
            results = model(frame, verbose=False)
            
            for r in results:
                if r.boxes:
                    for i, box in enumerate(r.boxes):
                        # Coordinates & Confidence
                        x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                        score = box.conf[0].item()
                        w, h = x2 - x1, y2 - y1
                        
                        color = (255, 165, 0) # Orange (Standard)
                        
                        # Fall Logic: If box is horizontal and confidence is high
                        if score > conf_level and w > h:
                            color = (0, 0, 255) # Red (Fall)
                            
                            # Alert Logic (1 email per minute)
                            if time.time() - last_mail > 60:
                                if send_alert(score):
                                    st.toast(f"Email sent to {target_email}!", icon="📧")
                                last_mail = time.time()

                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                        cv2.putText(frame, f"Score: {score:.2f}", (x1, y1-10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

            frame_window.image(frame, channels="BGR", use_container_width=True)
        cap.release()

with tab2:
    st.write("Click 'Start' to use your webcam for the live demo.")
    cam_run = st.toggle("Start Live Camera")
    
    if cam_run:
        cap = cv2.VideoCapture(0)
        # Check if camera opened correctly
        if not cap.isOpened():
            st.error("Could not access the webcam.")
        else:
            frame_window = st.empty()
            last_mail = 0
            
            try:
                while cam_run:
                    ret, frame = cap.read()
                    if not ret:
                        st.error("Failed to grab frame.")
                        break
                    
                    # AI Inference
                    results = model(frame, verbose=False)
                    
                    for r in results:
                        if r.boxes:
                            for i, box in enumerate(r.boxes):
                                x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                                score = box.conf[0].item()
                                w, h = x2 - x1, y2 - y1
                                
                                color = (255, 165, 0) # Orange
                                
                                if score > conf_level and w > h:
                                    color = (0, 0, 255) # Red
                                    if time.time() - last_mail > 60:
                                        if send_alert(score):
                                            st.toast(f"Email sent to {target_email}!", icon="📧")
                                        last_mail = time.time()

                                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                                cv2.putText(frame, f"Score: {score:.2f}", (x1, y1-10), 
                                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    frame_window.image(frame, channels="BGR", use_container_width=True)
            
            finally:
                # This ensures release happens even if the loop breaks or errors
                cap.release()
                cv2.destroyAllWindows()
                st.write("Camera released.")
    else:
        st.info("Camera is currently OFF.")
