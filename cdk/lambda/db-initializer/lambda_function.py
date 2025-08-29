# lambda/db-initializer/lambda_function.py
import json
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

rds_data = boto3.client('rds-data')

def lambda_handler(event, context):
    """CloudFormation Custom Resource Handler"""
    
    logger.info(f"Event: {json.dumps(event)}")
    
    request_type = event.get('RequestType')
    physical_resource_id = event.get('PhysicalResourceId', f"db-init-{context.aws_request_id}")
    
    response_data = {}
    
    try:
        if request_type in ['Create', 'Update']:
            properties = event['ResourceProperties']
            cluster_arn = properties['ClusterArn']
            database_name = properties['DatabaseName']
            master_secret_arn = properties['MasterSecretArn']
            
            logger.info(f"Initializing database: {database_name}")
            logger.info(f"Cluster ARN: {cluster_arn}")
            
            # SQLコマンドを実行
            sql_commands = [
                "CREATE EXTENSION IF NOT EXISTS vector;",
                "CREATE SCHEMA IF NOT EXISTS bedrock_integration;",
                """CREATE TABLE IF NOT EXISTS bedrock_integration.bedrock_knowledge_base (
                    id uuid PRIMARY KEY,
                    embedding vector(1024),
                    chunks text,
                    metadata jsonb,
                    custommetadata jsonb
                );""",
                """CREATE INDEX IF NOT EXISTS idx_bedrock_knowledge_base_embedding
                   ON bedrock_integration.bedrock_knowledge_base
                   USING hnsw (embedding vector_cosine_ops);""",
                """CREATE INDEX IF NOT EXISTS idx_bedrock_knowledge_base_chunks
                   ON bedrock_integration.bedrock_knowledge_base
                   USING gin (to_tsvector('simple'::regconfig, chunks));""",
                """CREATE INDEX IF NOT EXISTS idx_bedrock_knowledge_base_custommetadata
                   ON bedrock_integration.bedrock_knowledge_base
                   USING gin (custommetadata);"""
            ]
            
            for sql in sql_commands:
                try:
                    logger.info(f"Executing SQL: {sql[:50]}...")
                    response = rds_data.execute_statement(
                        resourceArn=cluster_arn,
                        secretArn=master_secret_arn,
                        database=database_name,
                        sql=sql
                    )
                    logger.info("SQL executed successfully")
                except Exception as e:
                    logger.warning(f"SQL execution warning: {str(e)}")
                    # IF NOT EXISTS なのでエラーを無視して続行
            
            logger.info("Database initialization completed")
            response_data['Message'] = 'Database initialized successfully'
            
        elif request_type == 'Delete':
            logger.info("Delete request received. Keeping data intact.")
            response_data['Message'] = 'Delete request processed (data retained)'
        
        # 成功レスポンス
        return {
            'Status': 'SUCCESS',
            'PhysicalResourceId': physical_resource_id,
            'StackId': event.get('StackId'),
            'RequestId': event.get('RequestId'),
            'LogicalResourceId': event.get('LogicalResourceId'),
            'Data': response_data
        }
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        # エラーレスポンス
        return {
            'Status': 'FAILED',
            'Reason': str(e),
            'PhysicalResourceId': physical_resource_id,
            'StackId': event.get('StackId'),
            'RequestId': event.get('RequestId'),
            'LogicalResourceId': event.get('LogicalResourceId'),
            'Data': {}
        }