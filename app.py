from flask import Flask, render_template, request, jsonify
import random

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        hr = float(data.get('HR', 0))
        o2sat = float(data.get('O2Sat', 0))
        temp = float(data.get('Temp', 0))
        sbp = float(data.get('SBP', 0))
        map_val = float(data.get('MAP', 0))
        dbp = float(data.get('DBP', 0))
        resp = float(data.get('Resp', 0))
        age = float(data.get('Age', 0))

        # Mocking the Random Forest logic / Scaler
        abnormality = 0
        drivers = []
        
        def add_driver(name, diff):
            if diff > 0:
                drivers.append({"name": name, "value": min(diff, 100)})
                return diff
            return 0

        abnormality += add_driver("Heart Rate", abs(hr - 80) * 0.5)
        abnormality += add_driver("Temperature", abs(temp - 37) * 5)
        abnormality += add_driver("O2 Saturation", max(0, 98 - o2sat) * 2)
        abnormality += add_driver("Systolic BP", abs(sbp - 120) * 0.4)
        abnormality += add_driver("Respiration", abs(resp - 16) * 1.5)

        risk_score = min(max(int(abnormality * 2 + (15 if age > 65 else 0)), 5), 98)
        
        # Explainable AI subset
        drivers = sorted(drivers, key=lambda x: x['value'], reverse=True)[:3]
        if not drivers:
            drivers = [{"name": "Baseline Risk", "value": 10}]
            
        if risk_score > 70:
            level = "High"
            rec = "CRITICAL WARNING: Patient meets criteria for immediate intervention. Alert Code Blue / RRT team immediately."
        elif risk_score > 35:
            level = "Moderate"
            rec = "ELEVATED CONCERN: Vitals show signs of instability. Increase monitoring frequency to q1h and review labs."
        else:
            level = "Low"
            rec = "STABLE: Vitals are within expected baseline parameters. Continue standard care plan."

        return jsonify({
            "risk": risk_score,
            "level": level,
            "recommendation": rec,
            "drivers": drivers
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)
