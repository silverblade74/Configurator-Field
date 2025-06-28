## Running the SHI Field Configurator

### Requirements

- Python 3.9+
- `streamlit~=1.35.0`
- `pandas>=2.2,<3`

Install requirements:

```sh
pip install -r requirements.txt
```

### Running locally

```sh
bash run.sh
```

Or directly:

```sh
streamlit run shi_field_configurator.py --server.address 0.0.0.0 --server.port 8501 --server.headless true
```

### Deploying to cloud

Make sure your environment sets the `PORT` variable (e.g. Heroku, Railway).  
If using a `Procfile` (for Heroku):

```
web: streamlit run shi_field_configurator.py --server.address 0.0.0.0 --server.port $PORT --server.headless true
```