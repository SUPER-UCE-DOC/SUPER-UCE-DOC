import tensorflow as tf
try:
    from tensorflow.lite.python.interpreter import Interpreter
except ImportError:
    try:
        from tensorflow.lite import Interpreter
    except ImportError:
        Interpreter = tf.lite.Interpreter
import pandas as pd
import numpy as np
from typing import Optional, List
from dataclasses import dataclass

@dataclass
class Landmark:
    x: float
    y: float
    z: Optional[float] = None
    visibility: Optional[float] = None

@dataclass
class LandmarkData:
    timeInSeconds: float
    frameNumber: int
    poseLandmarks: Optional[List[Landmark]] = None
    faceLandmarks: Optional[List[Landmark]] = None
    leftHandLandmarks: Optional[List[Landmark]] = None
    rightHandLandmarks: Optional[List[Landmark]] = None

class IsolatedASLRecognition:
    def __init__(self, model_path: str):
        # API state variables
        self.all_landmarks = None
        self.unique_signs = []
        self.sign_name = ""
        self.pred_sentence = ""

        # Initialize TensorFlow Lite model
        self.interpreter = Interpreter(model_path=model_path + "/model.tflite")
        self.interpreter.allocate_tensors()
        self.model = self.interpreter.get_signature_runner("serving_default")

        # Load dictionary of signs
        dict_sign = pd.read_csv(model_path + "/dict_sign.csv")
        self.ORD2SIGN = dict_sign.set_index('sign_ord')['sign'].to_dict()

        # Landmark counts and types
        self.landmark_counts = {"face": 478, "pose": 33, "left_hand": 21, "right_hand": 21}
        self.landmark_types = {
            "faceLandmarks": "face",
            "poseLandmarks": "pose",
            "leftHandLandmarks": "left_hand",
            "rightHandLandmarks": "right_hand",
        }

    def process_landmarks(self, landmarks: Optional[List], landmark_type: str) -> pd.DataFrame:
        """
        Convert a list of landmarks into a structured DataFrame.
        """
        if not landmarks:
            return pd.DataFrame()

        return pd.DataFrame(
            [(i, point.x, point.y, point.z) for i, point in enumerate(landmarks)],
            columns=["landmark_index", "x", "y", "z"]
        ).assign(type=landmark_type)

    def create_frame_landmark_df(self, data) -> pd.DataFrame:
        """
        Create a DataFrame for all landmarks from a LandmarkData object.
        """
        # Process each type of landmark into a DataFrame
        processed = [self.process_landmarks(getattr(data, key), value) for key, value in self.landmark_types.items()]
        processed = [p for p in processed if not p.empty]

        if processed:
            landmarks = pd.concat(processed, ignore_index=True)
        else:
            landmarks = pd.DataFrame(columns=["landmark_index", "x", "y", "z", "type"])
        landmarks["frame"] = data.frameNumber

        # Fill missing landmarks for types not detected
        for type_, count in self.landmark_counts.items():
            if landmarks[landmarks["type"] == type_].empty:
                missing_df = pd.DataFrame({
                    "landmark_index": range(count),
                    "x": np.nan,
                    "y": np.nan,
                    "z": np.nan,
                    "type": type_,
                    "frame": data.frameNumber
                })
                landmarks = pd.concat([landmarks, missing_df], ignore_index=True)

        # Drop unused landmark indices (e.g., Iris) and reset the index
        landmarks = landmarks[landmarks["landmark_index"] < 468].reset_index(drop=True)
        return landmarks

    def predict(self, data):
        """
        Handle predictions based on the incoming landmark data.
        Uses TensorFlow Lite model for sign language recognition.
        """
        if data[0].timeInSeconds <= 4:
            self.sign_name = "No Movement Detected"
            self.unique_signs.clear()
            self.pred_sentence = ""

        # Process the current frame's landmarks efficiently
        processed_landmarks = [
            self.create_frame_landmark_df(data_i) for data_i in data
        ]
        self.all_landmarks = pd.concat(
            processed_landmarks, ignore_index=True
        ).sort_values(by=["frame", "type", "landmark_index"]).reset_index(drop=True)

        # Prepare data for prediction
        data_columns = ["x", "y", "z"]
        frames_count = len(self.all_landmarks["frame"].unique())
        xyz_np = self.all_landmarks[data_columns].to_numpy().reshape(
            frames_count, 543, len(data_columns)
        ).astype(np.float32)

        # Run the model prediction
        prediction = self.model(inputs=xyz_np)
        outputs = prediction['outputs']
        
        # Calcular Softmax para obtener verdaderas probabilidades
        if len(outputs.shape) > 1:
            logits = outputs[0]
        else:
            logits = outputs
            
        exp_logits = np.exp(logits - np.max(logits))
        probs = exp_logits / np.sum(exp_logits)
        
        # Obtener Top-1 y Top-2
        top2_idx = np.argsort(probs)[-2:]
        top1_idx = top2_idx[1]
        top2_idx = top2_idx[0]
        
        top1_conf = float(probs[top1_idx])
        top2_conf = float(probs[top2_idx])
        raw_logit = float(logits[top1_idx])
        
        sign_index = top1_idx
        # Mantenemos el confidence actual (logit) para no romper el backend durante la captura
        confidence = float(logits[top1_idx]) 
        self.sign_name = self.ORD2SIGN.get(sign_index, "Unknown Sign")
        top2_name = self.ORD2SIGN.get(top2_idx, "Unknown Sign")

        # LOG REAL DATA CAPTURE
        import csv
        with open('real_predictions_log.csv', mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # frame, sign_name, top1_prob, top2_prob, raw_logit, top2_name
            writer.writerow([data[0].frameNumber, self.sign_name, top1_conf, top2_conf, raw_logit, top2_name])

        # Reset state or update unique signs and sentence
        if self.sign_name in {"", "jeans"} or top1_conf < 0.1:
            self.sign_name = "No Movement Detected"
            self.unique_signs.clear()
            self.pred_sentence = ""
        else:
            if self.sign_name not in self.unique_signs:
                self.unique_signs.append(self.sign_name)
            if len(self.unique_signs) > 1:
                self.pred_sentence = " ".join(self.unique_signs)

        # Clear landmarks for the next prediction cycle
        self.all_landmarks = None

        return {
            "status": 200,
            "sign": self.sign_name,
            "confidence": confidence,
            "list_sign": self.unique_signs,
            "sentence": self.pred_sentence,
        }