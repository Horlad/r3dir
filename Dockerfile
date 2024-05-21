FROM python:3.10
WORKDIR /code
COPY ./requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt
COPY ./server /code/server
COPY ./encoder /code/encoder

CMD ["uvicorn", "app.server:app", "--proxy-headers", "--host", "0.0.0.0", "--port", "80"]
EXPOSE 80
