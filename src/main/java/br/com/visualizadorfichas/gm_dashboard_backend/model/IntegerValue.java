package br.com.visualizadorfichas.gm_dashboard_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Objects;

@JsonIgnoreProperties(ignoreUnknown = true)
public class IntegerValue {

    private String integerValue;

    public IntegerValue() {}

    public String getIntegerValue() { return integerValue; }
    public void setIntegerValue(String integerValue) { this.integerValue = integerValue; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        IntegerValue that = (IntegerValue) o;
        return Objects.equals(integerValue, that.integerValue);
    }

    @Override
    public int hashCode() {
        return Objects.hash(integerValue);
    }
}