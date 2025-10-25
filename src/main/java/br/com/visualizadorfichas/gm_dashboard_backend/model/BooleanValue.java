package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BooleanValue {

    private boolean booleanValue;

    public BooleanValue() {}

    public boolean isBooleanValue() { return booleanValue; }
    public void setBooleanValue(boolean booleanValue) { this.booleanValue = booleanValue; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BooleanValue that = (BooleanValue) o;
        return booleanValue == that.booleanValue;
    }

    @Override
    public int hashCode() {
        return Objects.hash(booleanValue);
    }
}