library(readr) # Para leer CSV en R
library(dplyr) # Para manipulación de datos
library(ggplot2) # Para gráficos
datos <- read.csv("datos.csv")
datos$estado[datos$estado == "activo"] <- "1" 
datos$estado[datos$estado == "inactivo"] <- "0"
df <- datos %>% 
  filter(estado != "") %>%
  select(estado, ventas) %>%
  group_by(estado) %>%
  summarise(total = sum(ventas))

if (length(df) > 0){
     grafico <- ggplot(df, aes(x=estado, y=total, fill=estado)) +
    geom_bar(stat="identity") +
    scale_fill_brewer(palette="Set3") +
    theme_minimal() +
    labs(x="Estado", y="Total de ventas")

    for (i in seq_len(nrow(df))) {
        print(df[i,])
    }

ggsave("resultado.png", grafico, width=8, height=6)

}
   



