CXX = g++
CXXFLAGS = -I /home/daugeldauge/local/include -std=c++0x -Wall -O2
LDFLAGS = -L /home/daugeldauge/local/lib -lcgraph -lgvc -lm
DIR = ../bin
EXECUTABLE = levels
TARGET = $(DIR)/$(EXECUTABLE)
SRC = $(EXECUTABLE).cpp

all: $(TARGET)
$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)
clean:
	rm $(TARGET)