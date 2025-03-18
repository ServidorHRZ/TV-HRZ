# Cargar las bibliotecas necesarias
library(readr)
library(dplyr) 
library(ggplot2)

datos <- read.csv("datos.csv")

# Agrupar y contar los datos
datos_agrupados <- datos %>%
  group_by(categoria) %>%
  summarise(total = n()) %>%
  arrange(desc(total))

grafica <- ggplot(datos_agrupados, aes(x="", y=total, fill=categoria)) +
  geom_bar(stat="identity", width=1) +
  coord_polar("y", start=0) +
  labs(title="Distribución de Categorías",
       fill="Categoría",
       x="",
       y="Total") +
  theme_minimal() +
  theme(axis.text.x=element_blank(),
        plot.title=element_text(hjust=0.5)) +
  geom_text(aes(label=paste0(round(total/sum(total)*100, 1), "%")), 
            position=position_stack(vjust=0.5))

# Mostrar la gráfica
print(grafica)

# Guardar la gráfica
ggsave("grafica.png", grafica, width=8, height=6)
