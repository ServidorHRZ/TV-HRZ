import pandas as pd

try:
    df = pd.read_csv('archivo.csv')
    
    if 'DOCUMENTOS' in df.columns:
        df['DOCUMENTOS'] = df['DOCUMENTOS'].replace({
            'valor_antiguo1': 'valor_nuevo1',
            'valor_antiguo2': 'valor_nuevo2',
        })
        
        df.to_csv('archivo_modificado.csv', index=False)
        print("Los valores han sido reemplazados exitosamente")
        
    else:
        print("Error: La columna 'DOCUMENTOS' no existe en el archivo CSV")
        
except FileNotFoundError:
    print("Error: No se encontró el archivo CSV")
except Exception as e:
    print(f"Error inesperado: {str(e)}")
