import numpy as np
import pandas as pd

datos = np.random.randint(0, 100, size=10)

df_datos = pd.DataFrame(datos, columns=['Numeros'])

try:
    df_datos.to_csv('datos.csv', index=False)
    print("El vector se ha guardado exitosamente en 'datos.csv'")
except Exception as e:
    print(f"Error al guardar el archivo: {str(e)}")

