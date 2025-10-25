package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class CharacterFields {

    private StringValue name;
    private IntegerValue currentPv;
    private IntegerValue maxPv;
    private IntegerValue currentSan;
    private IntegerValue maxSan;
    private IntegerValue currentPe;
    private IntegerValue maxPe;

    @JsonProperty("sheetPictureURL")
    private StringValue sheetPictureURL;

    private BooleanValue deathMode;
    private BooleanValue madnessMode;
    private IntegerValue evade;

    @JsonProperty("block")
    private IntegerValue blockValue; // Mapeia o JSON "block" para este campo

    private IntegerValue movement;
    private StringValue nex;
    private StringValue className;
    private IntegerValue currentLoad;
    private IntegerValue maxLoad;

    // Construtor vazio
    public CharacterFields() {
    }

    // --- Getters e Setters ---

    public StringValue getName() { return name; }
    public void setName(StringValue name) { this.name = name; }

    public IntegerValue getCurrentPv() { return currentPv; }
    public void setCurrentPv(IntegerValue currentPv) { this.currentPv = currentPv; }

    public IntegerValue getMaxPv() { return maxPv; }
    public void setMaxPv(IntegerValue maxPv) { this.maxPv = maxPv; }

    public IntegerValue getCurrentSan() { return currentSan; }
    public void setCurrentSan(IntegerValue currentSan) { this.currentSan = currentSan; }

    public IntegerValue getMaxSan() { return maxSan; }
    public void setMaxSan(IntegerValue maxSan) { this.maxSan = maxSan; }

    public IntegerValue getCurrentPe() { return currentPe; }
    public void setCurrentPe(IntegerValue currentPe) { this.currentPe = currentPe; }

    public IntegerValue getMaxPe() { return maxPe; }
    public void setMaxPe(IntegerValue maxPe) { this.maxPe = maxPe; }

    public StringValue getSheetPictureURL() { return sheetPictureURL; }
    public void setSheetPictureURL(StringValue sheetPictureURL) { this.sheetPictureURL = sheetPictureURL; }

    public BooleanValue getDeathMode() { return deathMode; }
    public void setDeathMode(BooleanValue deathMode) { this.deathMode = deathMode; }

    public BooleanValue getMadnessMode() { return madnessMode; }
    public void setMadnessMode(BooleanValue madnessMode) { this.madnessMode = madnessMode; }

    public IntegerValue getEvade() { return evade; }
    public void setEvade(IntegerValue evade) { this.evade = evade; }

    public IntegerValue getBlockValue() { return blockValue; }
    public void setBlockValue(IntegerValue blockValue) { this.blockValue = blockValue; }

    public IntegerValue getMovement() { return movement; }
    public void setMovement(IntegerValue movement) { this.movement = movement; }

    public StringValue getNex() { return nex; }
    public void setNex(StringValue nex) { this.nex = nex; }

    public StringValue getClassName() { return className; }
    public void setClassName(StringValue className) { this.className = className; }

    public IntegerValue getCurrentLoad() { return currentLoad; }
    public void setCurrentLoad(IntegerValue currentLoad) { this.currentLoad = currentLoad; }

    public IntegerValue getMaxLoad() { return maxLoad; }
    public void setMaxLoad(IntegerValue maxLoad) { this.maxLoad = maxLoad; }

    // --- Equals e HashCode ---

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        CharacterFields that = (CharacterFields) o;
        return Objects.equals(name, that.name) &&
                Objects.equals(currentPv, that.currentPv) &&
                Objects.equals(maxPv, that.maxPv) &&
                Objects.equals(currentSan, that.currentSan) &&
                Objects.equals(maxSan, that.maxSan) &&
                Objects.equals(currentPe, that.currentPe) &&
                Objects.equals(maxPe, that.maxPe) &&
                Objects.equals(sheetPictureURL, that.sheetPictureURL) &&
                Objects.equals(deathMode, that.deathMode) &&
                Objects.equals(madnessMode, that.madnessMode) &&
                Objects.equals(evade, that.evade) &&
                Objects.equals(blockValue, that.blockValue) &&
                Objects.equals(movement, that.movement) &&
                Objects.equals(nex, that.nex) &&
                Objects.equals(className, that.className) &&
                Objects.equals(currentLoad, that.currentLoad) &&
                Objects.equals(maxLoad, that.maxLoad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, currentPv, maxPv, currentSan, maxSan, currentPe, maxPe,
                sheetPictureURL, deathMode, madnessMode, evade, blockValue,
                movement, nex, className, currentLoad, maxLoad);
    }
}