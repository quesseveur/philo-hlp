# Nom de votre fichier principal (sans l'extension .tex)
TARGET = SUJETS-HLP-Terminale-Banque-indexée-sujets-corrections

# On ajoute "build" à la liste des cibles fantômes
.PHONY: all build

# La commande "make" lancera par défaut la cible "build"
all: build

# La cible build lancera toujours la compilation, quoi qu'il arrive
build:
	xelatex -synctex=1 -interaction=nonstopmode --shell-escape $(TARGET).tex
	
clean:
	@echo "Nettoyage des fichiers auxiliaires et d'indexation..."
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.mw
	rm -f *.idx *.ind *.ilg *.synctex.gz
	@echo "Nettoyage terminé."

clean-all: clean
	@echo "Suppression du PDF..."
	rm -f *.pdf
	@echo "Projet remis à neuf."
	
make-all:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.mw
	rm -f *.idx *.ind *.ilg *.synctex.gz *.pdf
	xelatex -synctex=1 -interaction=nonstopmode --shell-escape $(TARGET).tex
	xelatex -synctex=1 -interaction=nonstopmode --shell-escape $(TARGET).tex
	xelatex -synctex=1 -interaction=nonstopmode --shell-escape $(TARGET).tex
