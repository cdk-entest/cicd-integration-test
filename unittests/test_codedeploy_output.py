import boto3

s3 = boto3.client("s3")
data = s3.get_object(
    Bucket="devopscicdpipelinestack-devopsdemopipelineartifac-m2uvtnu360mq",
    Key="DevOpsDemoPipeline/PreProduct/anx036s"
)
content = data['Body'].read()
print(content.decode("utf-8"))
